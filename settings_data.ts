// GENERATED CODE: DO NOT EDIT
//
// Run extract_settings_type_definitions instead.


// Valid boolean settings
export type BoolSettingName = (
    "debug" |
    "global-presets" |
    "moveresize-enabled" |
    "show-icon" |
    "show-tabs");

// A setting name for a number-valued setting.
export type NumberSettingName = (
    "insets-primary-bottom" |
    "insets-primary-left" |
    "insets-primary-right" |
    "insets-primary-top" |
    "insets-secondary-bottom" |
    "insets-secondary-left" |
    "insets-secondary-right" |
    "insets-secondary-top" |
    "window-margin");

// A setting for a key binding i.e. a 'preset' in the app.ts code.
export type KeyBindingSettingName = (
    "preset-move-left" |
    "preset-move-right");

// A setting name for a string-valued setting.
export type StringSettingName = (
    "");

// Any valid setting name.
export type AnySettingName = (
    "debug" |
    "global-presets" |
    "insets-primary-bottom" |
    "insets-primary-left" |
    "insets-primary-right" |
    "insets-primary-top" |
    "insets-secondary-bottom" |
    "insets-secondary-left" |
    "insets-secondary-right" |
    "insets-secondary-top" |
    "moveresize-enabled" |
    "preset-move-left" |
    "preset-move-right" |
    "show-icon" |
    "show-tabs" |
    "window-margin");

export class ParsedSettings {
    /** Put debug lines into global.log. To see, run journalctl /usr/bin/gnome-shell -f in terminal */
    ["debug"]: boolean = false;

    /** Keyboard presets are always active (as opposed active only when tiling window is visible). */
    ["global-presets"]: boolean = true;

    /** Bottom gap around border of screen for primary monitor */
    ["insets-primary-bottom"]: number = 0;

    /** Left gap around border of screen for primary monitor */
    ["insets-primary-left"]: number = 0;

    /** Right gap around border of screen for primary monitor */
    ["insets-primary-right"]: number = 0;

    /** Top gap around border of screen for primary monitor */
    ["insets-primary-top"]: number = 0;

    /** Bottom gap around border of screen for secondary monitor */
    ["insets-secondary-bottom"]: number = 0;

    /** Left gap around border of screen for secondary monitor */
    ["insets-secondary-left"]: number = 0;

    /** Right gap around border of screen for secondary monitor */
    ["insets-secondary-right"]: number = 0;

    /** Top gap around border of screen for secondary monitor */
    ["insets-secondary-top"]: number = 0;

    /** Enables shortcuts for moving and resizing the current window. */
    ["moveresize-enabled"]: boolean = true;

    /** Preset move right. */
    ["preset-move-right"]: string[] = ['<Alt>L'];

    /** Preset move left. */
    ["preset-move-left"]: string[] = ['<Alt>H'];

    /** Show gSnap icon on a panel. */
    ["show-icon"]: boolean = true;

    /** Show tabs for windows in each zone. */
    ["show-tabs"]: boolean = true;

    /** Gaps between windows in the middle of screen */
    ["window-margin"]: number = 0;
}

export const DEBUG = "debug";
export const GLOBAL_PRESETS = "global-presets";
export const INSETS_PRIMARY_BOTTOM = "insets-primary-bottom";
export const INSETS_PRIMARY_LEFT = "insets-primary-left";
export const INSETS_PRIMARY_RIGHT = "insets-primary-right";
export const INSETS_PRIMARY_TOP = "insets-primary-top";
export const INSETS_SECONDARY_BOTTOM = "insets-secondary-bottom";
export const INSETS_SECONDARY_LEFT = "insets-secondary-left";
export const INSETS_SECONDARY_RIGHT = "insets-secondary-right";
export const INSETS_SECONDARY_TOP = "insets-secondary-top";
export const PRESET_MOVE_RIGHT = "preset-move-right";
export const PRESET_MOVE_LEFT = "preset-move-left";
export const MOVERESIZE_ENABLED = "moveresize-enabled";
export const SHOW_ICON = "show-icon";
export const SHOW_TABS = "show-tabs";
export const WINDOW_MARGIN = "window-margin";
