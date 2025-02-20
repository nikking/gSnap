// GJS import system
declare var imports: any;
declare var global: any;
import {log} from './logging';
import {getCurrentPath} from './utils';
import {ShellVersion} from './shellversion';
import {bind as bindHotkeys, unbind as unbindHotkeys, Bindings} from './hotkeys';
import {ZonePreview, TabbedZoneManager, EntryDialog, ZoneManager} from "./editor";

const Gettext = imports.gettext;
const _ = Gettext.gettext;
import {
    Display,
    GrabOp,
    Window,
    WindowType,
    WorkspaceManager as WorkspaceManagerInterface
} from "./gnometypes";

import { 
    activeMonitors,
    getCurrentMonitorIndex
} from './monitors';

import { 
    deinitSettings, 
    gridSettings, 
    initSettings,
} from './settings';

import * as SETTINGS from './settings_data';

import { Layout, LayoutsSettings, WorkspaceMonitorSettings } from './layouts';

/*****************************************************************

 This extension has been developed by micahosborne

 With the help of the gnome-shell community

 Edited by Kvis for gnome 3.8
 Edited by Lundal for gnome 3.18
 Edited by Sergey to add keyboard shortcuts and prefs dialog

 ******************************************************************/

/*****************************************************************
 CONST & VARS
 *****************************************************************/

// Library imports
const Main = imports.ui.main;
const GObject = imports.gi.GObject;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const GLib = imports.gi.GLib;

// Getter for accesing "get_active_workspace" on GNOME <=2.28 and >= 2.30
const WorkspaceManager: WorkspaceManagerInterface = (
    global.screen || global.workspace_manager);

let launcher: GSnapStatusButtonClass | null;
let enabled = false;
let monitorsChangedConnect: any = false;

const SHELL_VERSION = ShellVersion.defaultVersion();

// Hangouts workaround

const keyBindings: Bindings = new Map([

]);

const key_bindings_presets: Bindings = new Map([
    [SETTINGS.PRESET_MOVE_RIGHT, () => {
        globalApp.cycleZone(1);
    }],
    [SETTINGS.PRESET_MOVE_LEFT, () => {
        globalApp.cycleZone(-1);
    }],
]);

const keyBindingGlobalResizes: Bindings = new Map([

]);

class App {
    // private editor: (ZoneEditor | null)[];
    private preview: (ZonePreview | null)[];
    private tabManager: (ZoneManager | null)[];

    private currentLayout: Layout;
    public layouts : LayoutsSettings = {
        // [workspaceindex][monitorindex]
        workspaces: [
            [{ current: 0 }, { current: 0 }],
            [{ current: 0 }, { current: 0 }]
        ],
        definitions: [
            {
                type: 0,
                name: "2 Column",
                length: 100,
                items: [
                    {type:0, length: 50, items: []},
                    {type:0, length: 50, items: []}
                ]
            },
        ]
    };

    constructor() {
        const monitors = activeMonitors().length;
        // this.editor = new Array<ZoneEditor>(monitors);
        this.preview = new Array<ZonePreview>(monitors);
        this.tabManager = new Array<ZoneManager>(monitors);
        this.currentLayout = this.layouts.definitions[0];
    }
    
    private restackConnection: any;
    private workspaceSwitchedConnect: any;
    private workareasChangedConnect: any;

    cycleZone(direction: number) {
        log(`cycle zone with direction: ${direction}`);

        // get current window
        let win = global.display.get_focus_window();

        let currentMonitorIndex = -1;
        let currentWidgetIndex = -1;
        for (let m of activeMonitors()) {
            currentWidgetIndex = this.tabManager[m.index]!.widgetContainsWindow(win);
            if (currentWidgetIndex > -1) {
                currentMonitorIndex = m.index;
                log(`window is in monitor ${currentMonitorIndex} and widget ${currentWidgetIndex}`)
                let tabManager = this.tabManager[currentMonitorIndex]!;
                let newWidgetIndex = currentWidgetIndex + direction;
                // handle rollover
                if (tabManager.recursiveChildren()[newWidgetIndex] === undefined) {
                    // handle monitor rollover
                    if (activeMonitors().length > 1) {
                        let newMonitorIndex = currentMonitorIndex + direction;
                        if (newMonitorIndex === -1) {
                            newMonitorIndex = activeMonitors().length - 1;
                        } else if (newMonitorIndex === activeMonitors().length) {
                            newMonitorIndex = 0;
                        }
                        tabManager = this.tabManager[newMonitorIndex]!;
                    }
                    // get widget index correct
                    if (direction === 1) {
                        newWidgetIndex = 0;
                    } else {
                        newWidgetIndex = tabManager!.recursiveChildren().length - 1;
                    }
                }
                tabManager.moveWindowToWidget(win, tabManager.recursiveChildren()[newWidgetIndex]);
                return;
            }
        };
        // default to widget 0 of current monitor
        this.tabManager[0]?.moveWindowToWidget(win, this.tabManager[0]?.recursiveChildren()[0]);
    }

    setLayout(layoutIndex: number, monitorIndex = -1) {
        log(`setting layout with index ${layoutIndex}`);
        if (this.layouts.definitions.length <= layoutIndex) {
            return;
        }
        
        this.currentLayout = this.layouts.definitions[layoutIndex];
        if (this.layouts.workspaces == null) {
            this.layouts.workspaces = [];
        }

        if(monitorIndex === -1 ) {
            monitorIndex = getCurrentMonitorIndex();
        }

        let workspaceIndex = WorkspaceManager.get_active_workspace().index();

        this.layouts.workspaces[workspaceIndex][monitorIndex].current = layoutIndex;
        this.saveLayouts();
        
        this.tabManager[monitorIndex]?.destroy();
        this.tabManager[monitorIndex] = null;

        this.tabManager[monitorIndex] = new ZoneManager(activeMonitors()[monitorIndex], this.currentLayout, gridSettings[SETTINGS.WINDOW_MARGIN]);

        this.tabManager[monitorIndex]?.layoutWindows();
        this.reloadMenu();
    }

    showLayoutPreview(monitorIndex: number, layout: Layout) {
        this.preview[monitorIndex]?.destroy();
        this.preview[monitorIndex] = null;

        this.preview[monitorIndex] = new ZonePreview(activeMonitors()[monitorIndex], layout, gridSettings[SETTINGS.WINDOW_MARGIN]);
    }

    hideLayoutPreview() {
        activeMonitors().forEach(monitor => {
            this.preview[monitor.index]?.destroy();
            this.preview[monitor.index] = null;
        });
    }

    enable() {
        try {
            let [ok, contents] = GLib.file_get_contents(getCurrentPath()?.replace("/extension.js", "/layouts.json"));
            if (ok) {
                log("Loaded contents " + contents);
                this.layouts = JSON.parse(contents);
                log(JSON.stringify(this.layouts));
                if(this.refreshLayouts()) {
                    this.saveLayouts();
                }
            }
        } catch (exception) {
            log(JSON.stringify(exception));
            let [ok, contents] = GLib.file_get_contents(getCurrentPath()?.replace("/extension.js", "/layouts-default.json"));
            if (ok) {
                this.layouts = JSON.parse(contents);
                this.refreshLayouts();
                this.saveLayouts();
            }
        }


        this.setToCurrentWorkspace();
        monitorsChangedConnect = Main.layoutManager.connect(
            'monitors-changed', () => {
                activeMonitors().forEach(m => {
                    this.tabManager[m.index]?.layoutWindows();
                });
                this.reloadMenu();
            });

        function validWindow(window: Window): boolean {
            return window != null
                && window.get_window_type() == WindowType.NORMAL;
        }

        global.display.connect('window-created', (_display: Display, win: Window) => {
            if(validWindow(win)) {
                activeMonitors().forEach(m => {
                    this.tabManager[m.index]?.layoutWindows();
                });
            }
        });
        
        global.display.connect('in-fullscreen-changed', (_display: Display) => {
            if (global.display.get_monitor_in_fullscreen(0)) {
                activeMonitors().forEach(m => {
                    this.tabManager[m.index]?.destroy();
                    this.tabManager[m.index] = null;
                });
            } else {
                this.setToCurrentWorkspace();
            }
            
        });

        // global.display.connect('window-drag-begin', (_display: Display, win: Window) => {
        //     log("window-drag-begin");
        // });

        // global.display.connect('window-drag-end', (_display: Display, win: Window) => {
        //     log("window-drag-end");
        // });

        // global.display.connect('window-drag-cancelled', (_display: Display, win: Window) => {
        //     log("window-drag-begin");
        // });

        global.display.connect('grab-op-begin', (_display: Display, win: Window, op: GrabOp) => {
            if(validWindow(win) && op == GrabOp.WINDOW_BASE) {
                activeMonitors().forEach(m => {
                    this.tabManager[m.index]?.show();
                });
            }

        });

        global.display.connect('grab-op-end', (_display: Display, win: Window, op: GrabOp) => {
            if(validWindow(win) && op == GrabOp.WINDOW_BASE) {
                activeMonitors().forEach(m => {
                    this.tabManager[m.index]?.hide();
                    this.tabManager[m.index]?.moveWindowToWidgetAtCursor(win);
                    // NK: What does layoutWindows do? Why was it here?
                    // this.tabManager[m.index]?.layoutWindows();
                });
            }
        });

        // global.display.connect('accelerator-activated', (display: any, action: any, deviceId: any, timestamp: any) => {
        //         log(`Accelerator Activated: [display=${display}, action=${action}, deviceId=${deviceId}, timestamp=${timestamp}]`)
        //     });

        // JS ERROR: Extension gSnap@micahosborne: Error: No signal 'key-press-event' on object 'MetaDisplay'
        // global.display.connect("key-press-event", (widget: any, event: any, user_data:any) => {
        //     let [success, keyval] = event.get_keyval(); // integer
        //     // let keyname = Gdk.keyval_name(keyval); // string keyname

        //     log(`key press: ${keyval}`);
        
        //     // if (keyname === "Control_L") {
        //     //     // Dialog code or eg. this.keys_array.push("<Ctrl>");
        //     // }
        // });

        this.restackConnection = global.display.connect('restacked', () => {
            activeMonitors().forEach(m => {
                this.tabManager[m.index]?.layoutWindows();
            });
        });

        this.workspaceSwitchedConnect = WorkspaceManager.connect('workspace-switched', () => {
            if(this.refreshLayouts()) {
                this.saveLayouts();
            }

            activeMonitors().forEach(m => {
                this.tabManager[m.index]?.destroy();
                this.tabManager[m.index] = null;
            });

            this.setToCurrentWorkspace();
        });

        this.workareasChangedConnect = global.display.connect('workareas-changed', () => {
            activeMonitors().forEach(m => {
                this.tabManager[m.index]?.reinit();
                this.tabManager[m.index]?.layoutWindows();
            });
        });

        launcher = new GSnapStatusButton('tiling-icon') as GSnapStatusButtonClass;
        launcher.label = "Layouts";
        if (gridSettings[SETTINGS.SHOW_ICON]) {
            Main.panel.addToStatusArea("GSnapStatusButton", launcher);
            this.reloadMenu();
        }

        bindHotkeys(keyBindings);
        if (gridSettings[SETTINGS.GLOBAL_PRESETS]) {
            bindHotkeys(key_bindings_presets);
        }
        if (gridSettings[SETTINGS.MOVERESIZE_ENABLED]) {
            bindHotkeys(keyBindingGlobalResizes);
        }

        enabled = true;

        log("Extension enable completed");
    }

    refreshLayouts() : boolean {
        let changed = false;
        
        // A workspace could have been added. Populate the layouts.workspace array
        let nWorkspaces = WorkspaceManager.get_n_workspaces();
        log(`refreshLayouts ${this.layouts.workspaces.length} ${nWorkspaces}`)
        while(this.layouts.workspaces.length < nWorkspaces) {
            let wk = new Array<WorkspaceMonitorSettings>(activeMonitors().length);
            wk.fill({ current: 0 });
            this.layouts.workspaces.push(wk);
            changed = true;
        }

        return changed;
    }

    reloadMenu() {
        if (launcher == null) return;
        launcher.menu.removeAll();
        // let resetLayoutButton = new PopupMenu.PopupMenuItem(_("Reset Layout"));
        // let editLayoutButton = new PopupMenu.PopupMenuItem(_("Edit Layout"));
        // let saveLayoutButton = new PopupMenu.PopupMenuItem(_("Save Layout"));
        // let cancelEditingButton = new PopupMenu.PopupMenuItem(_("Cancel Editing"));
        // let newLayoutButton = new PopupMenu.PopupMenuItem(_("Create New Layout"));

        // let renameLayoutButton = new PopupMenu.PopupMenuItem(_("Rename: " + this.currentLayout.name));

        const monitorsCount = activeMonitors().length;

        for(let mI = 0; mI < monitorsCount; mI++)
        {
            if(monitorsCount > 1) {
                let monitorName = new PopupMenu.PopupSubMenuMenuItem(_(`Monitor ${mI}`));
                launcher.menu.addMenuItem(monitorName);

                this.createLayoutMenuItems(mI).forEach(i => 
                    (<any>monitorName).menu.addMenuItem(i));
            } else {
                this.createLayoutMenuItems(mI).forEach(i =>
                    launcher?.menu.addMenuItem(i));
            }
        }

        let sep = new PopupMenu.PopupSeparatorMenuItem();
        launcher.menu.addMenuItem(sep);
        // launcher.menu.addMenuItem(editLayoutButton);
        // launcher.menu.addMenuItem(renameLayoutButton);
        // launcher.menu.addMenuItem(newLayoutButton);


        // renameLayoutButton.connect('activate', () => {
        //     let dialog = new EntryDialog({
        //         label: "test"
        //     });
        //     dialog.label.text = "Rename Layout " + this.currentLayout.name;
        //     dialog.entry.text = this.currentLayout.name;
        //     dialog.onOkay = (text: string) => {
        //         this.currentLayout.name = text;
        //         this.saveLayouts();
        //         this.reloadMenu();
        //     }
        //     dialog.open(global.get_current_time());
        // });

        // newLayoutButton.connect('activate', () => {
        //     let dialog = new EntryDialog();
        //     dialog.label.text = "Create New Layout";
        //     dialog.onOkay = (text: string) => {
        //         this.layouts.definitions.push({
        //             name: text,
        //             type: 0,
        //             length: 100,
        //             items: [
        //                 {
        //                     type: 0,
        //                     length: 100,
        //                     items: []
        //                 }
        //             ]
        //         });
        //         this.setLayout(this.layouts.definitions.length - 1);
        //         this.saveLayouts();
        //         this.reloadMenu();
        //     }
        //     dialog.open(global.get_current_time());
        // });

        // NK: I don't need a GUI editor.

        // editLayoutButton.connect('activate', () => {
        //     activeMonitors().forEach(m => {
        //         this.editor[m.index]?.destroy();
        //         this.editor[m.index] = new ZoneEditor(activeMonitors()[m.index], this.currentLayout, gridSettings[SETTINGS.WINDOW_MARGIN]);
        //     });

        //     var windows = WorkspaceManager.get_active_workspace().list_windows();
        //     for (let i = 0; i < windows.length; i++) {
        //         windows[i].minimize();
        //     }
        //     this.reloadMenu();
        // });

        // saveLayoutButton.connect('activate', () => {
        //     this.saveLayouts();
        //     this.setToCurrentWorkspace();
        //     this.reloadMenu();
        // });

        // resetLayoutButton.connect('activate', () => {
        //     activeMonitors().forEach(m => {
        //         let editor = this.editor[m.index];
        //         if (editor) {
        //             editor.destroy();
        //             editor.layoutItem = {
        //                 type: 0,
        //                 length: 100,
        //                 items: [
        //                     {
        //                         type: 0,
        //                         length: 100,
        //                         items: [],
        //                     }
        //                 ]
        //             }
        //             editor.applyLayout(editor);
        //             this.reloadMenu();
        //         }
        //     });
        // });

        // cancelEditingButton.connect('activate', () => {
        //     activeMonitors().forEach(m => {
        //         this.editor[m.index]?.destroy();
        //         this.editor[m.index] = null;
        //     });

        //     var windows = WorkspaceManager.get_active_workspace().list_windows();
        //     for (let i = 0; i < windows.length; i++) {
        //         windows[i].unminimize();
        //     }
        //     this.reloadMenu();
        // });
    }

    createLayoutMenuItems(monitorIndex: number) : Array<any> {
        let items = [];
        for (let i = 0; i < this.layouts.definitions.length; i++) {
            let item = new PopupMenu.PopupMenuItem(_(this.layouts.definitions[i].name == null ? "Layout " + i : this.layouts.definitions[i].name));
            item.connect('activate', () => {
                this.setLayout(i, monitorIndex);
                this.hideLayoutPreview();
            });
            item.actor.connect('enter-event', () => {
                this.showLayoutPreview(monitorIndex, this.layouts.definitions[i]);
            });
            item.actor.connect('leave-event', () => {
                this.hideLayoutPreview();
            });
            items.push(item);
        }
        return items;
    }

    saveLayouts() {
        // activeMonitors().forEach(m => {
        //     this.editor[m.index]?.apply();
        //     this.editor[m.index]?.destroy();
        //     this.editor[m.index] = null;
        // });
        GLib.file_set_contents(getCurrentPath()?.replace("/extension.js", "/layouts.json"), JSON.stringify(this.layouts));
        log(JSON.stringify(this.layouts));

        /// NK: I'm not sure what the purpose of this is so I'm commenting it out.
        // var windows = WorkspaceManager.get_active_workspace().list_windows();
        // for (let i = 0; i < windows.length; i++) {
        //     windows[i].unminimize();
        // }

    }

    disable() {
        log("Extension disable begin");
        enabled = false;
        this.preview?.forEach(p => { p?.destroy(); p = null });
        // this.editor?.forEach(e => { e?.destroy(); e = null; });
        this.tabManager?.forEach(t => { t?.destroy(); t = null });

        if (this.workspaceSwitchedConnect) {
            WorkspaceManager.disconnect(this.workspaceSwitchedConnect);
            this.workspaceSwitchedConnect = false;
        }
        if (this.restackConnection) {
            global.display.disconnect(this.restackConnection);
            this.restackConnection = false;
        }
        if (monitorsChangedConnect) {
            log("Disconnecting monitors-changed");
            Main.layoutManager.disconnect(monitorsChangedConnect);
            monitorsChangedConnect = false;
        }

        if(this.workareasChangedConnect) {
            global.display.disconnect(this.workareasChangedConnect);
            this.workareasChangedConnect = false;
        }

        unbindHotkeys(keyBindings);
        unbindHotkeys(key_bindings_presets);
        unbindHotkeys(keyBindingGlobalResizes);

        launcher?.destroy();
        launcher = null;
    }


    /**
     * onFocus is called when the global focus changes.
     */
    onFocus() { }

    showMenu() { }

    private setToCurrentWorkspace() {
        let currentWorkspaceIdx = WorkspaceManager.get_active_workspace().index();
        activeMonitors().forEach(m => {
            let currentLayoutIdx = this.layouts.workspaces[currentWorkspaceIdx][m.index].current;
            this.setLayout(currentLayoutIdx, m.index);
        });
    }
}

const globalApp = new App();

class GSnapStatusButtonClass extends PanelMenu.Button {
    _init(classname: string) {
        super._init(0.0, "gSnap", false);

        //Done by default in PanelMenuButton - Just need to override the method
        if (SHELL_VERSION.version_at_least_34()) {
            this.add_style_class_name(classname);
            this.connect('button-press-event', this._onButtonPress);
        } else {
            this.actor.add_style_class_name(classname);
            this.actor.connect('button-press-event', this._onButtonPress);
        }
        log("GSnapStatusButton _init done");
    }

    reset() {
        this.activated = false;
        if (SHELL_VERSION.version_at_least_34()) {
            this.remove_style_pseudo_class('activate');
        } else {
            this.actor.remove_style_pseudo_class('activate');
        }
    }

    activate() {
        if (SHELL_VERSION.version_at_least_34()) {
            this.add_style_pseudo_class('activate');
        } else {
            this.actor.add_style_pseudo_class('activate');
        }
    }

    deactivate() {
        if (SHELL_VERSION.version_at_least_34()) {
            this.remove_style_pseudo_class('activate');
        } else {
            this.actor.remove_style_pseudo_class('activate');
        }
    }

    _onButtonPress(_actor: any, _event: any) {
        log(`_onButtonPress Click Toggle Status on system panel ${this}`);
        globalApp.showMenu();
    }

    _destroy() {
        this.activated = null;
    }
}

const GSnapStatusButton = GObject.registerClass({
        GTypeName: 'GSnapStatusButton',
    }, GSnapStatusButtonClass
);

function changed_settings() {
    log("changed_settings");
    if (enabled) {
        disable();
        enable();
    }
    log("changed_settings complete");
}

export function enable() {
    initSettings(changed_settings);
    log("Extension enable begin");
    SHELL_VERSION.print_version();

    globalApp.enable();
}

export function disable() {
    deinitSettings();
    globalApp.disable();
}
