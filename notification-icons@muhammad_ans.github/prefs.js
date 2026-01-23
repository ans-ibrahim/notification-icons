import Gio from "gi://Gio";
import Adw from "gi://Adw";
import Gtk from "gi://Gtk";

import {
    ExtensionPreferences,
    gettext as _,
} from "resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js";

export default class NotificationIconsPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const generalPage = new Adw.PreferencesPage({
            title: _("General"),
            icon_name: "dialog-information-symbolic",
        });
        window.add(generalPage);

        const appearanceGroup = new Adw.PreferencesGroup({
            title: _("Appearance"),
            description: _("Customize the appearance of notification icons"),
        });
        generalPage.add(appearanceGroup);

        const iconSizeOptions = new Gtk.StringList();
        iconSizeOptions.append(_("Small (16px)"));
        iconSizeOptions.append(_("Medium (18px)"));
        iconSizeOptions.append(_("Large (20px)"));

        const iconSizeRow = new Adw.ComboRow({
            title: _("Icon Size"),
            subtitle: _("Choose the size of notification icons"),
            model: iconSizeOptions,
        });
        appearanceGroup.add(iconSizeRow);

        const coloredIconsRow = new Adw.SwitchRow({
            title: _("Colored Icons"),
            subtitle: _("Show colored icons instead of symbolic (monochrome) icons"),
        });
        appearanceGroup.add(coloredIconsRow);

        const notificationCountRow = new Adw.SwitchRow({
            title: _("Count Badge"),
            subtitle: _("Display the number of unread notifications"),
        });
        appearanceGroup.add(notificationCountRow);

        const hideCountWhenOneRow = new Adw.SwitchRow({
            title: _("Hide Single Count"),
            subtitle: _("Hide the badge when there is exactly one notification"),
        });
        appearanceGroup.add(hideCountWhenOneRow);

        const positionGroup = new Adw.PreferencesGroup({
            title: _("Position"),
            description: _("Configure where notification icons appear"),
        });
        generalPage.add(positionGroup);

        const rightSideRow = new Adw.SwitchRow({
            title: _("Right Side"),
            subtitle: _("Show icons on the right side of the clock instead of left"),
        });
        positionGroup.add(rightSideRow);

        const behaviorGroup = new Adw.PreferencesGroup({
            title: _("Behavior"),
            description: _("Configure how icons behave in different modes"),
        });
        generalPage.add(behaviorGroup);

        const dndOptions = new Gtk.StringList();
        dndOptions.append(_("Always Show"));
        dndOptions.append(_("Urgent Only"));
        dndOptions.append(_("Never Show"));

        const dndRow = new Adw.ComboRow({
            title: _("Do Not Disturb Mode"),
            subtitle: _("Choose when to show icons when Do Not Disturb is active."),
            model: dndOptions,
        });
        behaviorGroup.add(dndRow);

        window._settings = this.getSettings();

        window._settings.bind(
            "icon-size",
            iconSizeRow,
            "selected",
            Gio.SettingsBindFlags.DEFAULT
        );

        window._settings.bind(
            "notification-count",
            notificationCountRow,
            "active",
            Gio.SettingsBindFlags.DEFAULT
        );

        window._settings.bind(
            "hide-count-when-one",
            hideCountWhenOneRow,
            "active",
            Gio.SettingsBindFlags.DEFAULT
        );

        window._settings.bind(
            "notification-count",
            hideCountWhenOneRow,
            "sensitive",
            Gio.SettingsBindFlags.DEFAULT
        );

        window._settings.bind(
            "colored-icons",
            coloredIconsRow,
            "active",
            Gio.SettingsBindFlags.DEFAULT
        );

        window._settings.bind(
            "right-side",
            rightSideRow,
            "active",
            Gio.SettingsBindFlags.DEFAULT
        );

        window._settings.bind(
            "dnd-mode",
            dndRow,
            "selected",
            Gio.SettingsBindFlags.DEFAULT
        );
    }
}
