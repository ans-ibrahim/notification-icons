import Gio from "gi://Gio";
import Adw from "gi://Adw";
import Gtk from "gi://Gtk";

import {
  ExtensionPreferences,
  gettext as _,
} from "resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js";

export default class NotificationIconsPreferences extends ExtensionPreferences {
  fillPreferencesWindow(window) {
    // General Settings Page
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

    // Icon Size Setting
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

    // Colored Icons Setting
    const coloredIconsRow = new Adw.SwitchRow({
      title: _("Colored Icons"),
      subtitle: _("Show colored icons instead of symbolic (monochrome) icons"),
    });
    appearanceGroup.add(coloredIconsRow);

    // Position Settings Group
    const positionGroup = new Adw.PreferencesGroup({
      title: _("Position"),
      description: _("Configure where notification icons appear"),
    });
    generalPage.add(positionGroup);

    // Right Side Setting
    const rightSideRow = new Adw.SwitchRow({
      title: _("Right Side"),
      subtitle: _("Show icons on the right side of the clock instead of left"),
    });
    positionGroup.add(rightSideRow);

    // Behavior Settings Group
    const behaviorGroup = new Adw.PreferencesGroup({
      title: _("Behavior"),
      description: _("Configure how icons behave in different modes"),
    });
    generalPage.add(behaviorGroup);

    // DND Mode Setting
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

    // Bind settings
    window._settings = this.getSettings();
    
    // Icon size binding (0=16px, 1=18px, 2=20px)
    window._settings.bind(
      "icon-size",
      iconSizeRow,
      "selected",
      Gio.SettingsBindFlags.DEFAULT
    );

    // Colored icons binding
    window._settings.bind(
      "colored-icons",
      coloredIconsRow,
      "active",
      Gio.SettingsBindFlags.DEFAULT
    );

    // Right side binding
    window._settings.bind(
      "right-side",
      rightSideRow,
      "active",
      Gio.SettingsBindFlags.DEFAULT
    );

    // DND mode binding
    window._settings.bind(
      "dnd-mode",
      dndRow,
      "selected",
      Gio.SettingsBindFlags.DEFAULT
    );


  }
}
