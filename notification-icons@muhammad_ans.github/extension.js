import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import St from 'gi://St';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as MessageTray from 'resource:///org/gnome/shell/ui/messageTray.js';

class Icon {
    constructor(source, actualIconSize, gicon, iconName, coloredIcons, notificationCount, hideCountWhenOne) {
        this._source = source;
        this._hideCountWhenOne = hideCountWhenOne;

        this._widget = new St.Widget({
            layout_manager: new Clutter.BinLayout()
        });

        this._icon = new St.Icon({
            icon_size: actualIconSize,
            style_class: 'topbar-notification-icon',
        });

        if (gicon) {
            this._icon.gicon = gicon;
        } else {
            this._icon.icon_name = iconName || 'notification-symbolic';
        }

        if (!coloredIcons) {
            this._icon.add_style_class_name('app-menu-icon');
            this._icon.add_effect(new Clutter.DesaturateEffect());
        }

        this._widget.add_child(this._icon);

        if (notificationCount) {
            this._signal = source.connect('notify::count', this._updateNotificationCount.bind(this));

            this._badge = new St.Label({
                style_class: 'notification-count',
                text: this._getNotificationCount(),
                x_align: Clutter.ActorAlign.END,
                y_align: Clutter.ActorAlign.START
            });
            this._badge.visible = this._badge.text !== '';

            this._widget.add_child(this._badge);
        }
    }

    _getNotificationCount() {
        const count = this._source.notifications ? this._source.notifications.length : 0;
        if (this._hideCountWhenOne) {
            return count > 1 ? count.toString() : '';
        }
        return count > 0 ? count.toString() : '';
    }

    _updateNotificationCount() {
        this._badge.text = this._getNotificationCount();
        this._badge.visible = this._badge.text !== '';
    }
}


export default class TopbarNotificationIcons extends Extension {
    constructor(metadata) {
        super(metadata);
        this._topbarNotification = null;
        this._settings = null;
        this._signals = [];
    }

    enable() {
        this._settings = this.getSettings();
        this._topbarNotification = new TopbarNotification(this._settings);

        this._signals = [
            this._settings.connect('changed::right-side', this._onSettingsChanged.bind(this)),
            this._settings.connect('changed::colored-icons', this._onSettingsChanged.bind(this)),
            this._settings.connect('changed::dnd-mode', this._onSettingsChanged.bind(this)),
            this._settings.connect('changed::notification-count', this._onSettingsChanged.bind(this)),
            this._settings.connect('changed::hide-count-when-one', this._onSettingsChanged.bind(this)),
            this._settings.connect('changed::icon-size', this._onSettingsChanged.bind(this)),
        ];

        this._insertNotificationWidget();
    }

    disable() {
        if (this._signals) {
            this._signals.forEach(signal => {
                if (signal) {
                    this._settings.disconnect(signal);
                }
            });
            this._signals = [];
        }

        if (this._topbarNotification) {
            this._topbarNotification.destroy();
            this._topbarNotification = null;
        }

        this._settings = null;
    }

    _onSettingsChanged() {
        if (this._topbarNotification) {
            this._topbarNotification.updateSettings();
            this._repositionWidget();
        }
    }

    _insertNotificationWidget() {
        const dateMenu = Main.panel.statusArea.dateMenu;
        if (!dateMenu || !dateMenu._clockDisplay) {
            return;
        }

        const rightSide = this._settings.get_boolean('right-side');
        const container = dateMenu.get_first_child();

        if (rightSide) {
            container.insert_child_above(this._topbarNotification, dateMenu._clockDisplay);
        } else {
            container.insert_child_below(this._topbarNotification, dateMenu._clockDisplay);
        }
    }

    _repositionWidget() {
        const dateMenu = Main.panel.statusArea.dateMenu;
        if (!dateMenu || !dateMenu._clockDisplay) {
            return;
        }

        const rightSide = this._settings.get_boolean('right-side');
        const container = dateMenu.get_first_child();

        container.remove_child(this._topbarNotification);

        if (rightSide) {
            container.insert_child_above(this._topbarNotification, dateMenu._clockDisplay);
        } else {
            container.insert_child_below(this._topbarNotification, dateMenu._clockDisplay);
        }
    }
}

const TopbarNotification = GObject.registerClass(
    class TopbarNotification extends St.BoxLayout {
        _init(settings) {
            super._init({
                y_align: Clutter.ActorAlign.CENTER,
                x_align: Clutter.ActorAlign.CENTER,
                visible: true,
                style_class: 'topbar-notification-container'
            });

            this._settings = settings;
            this._icons = new Map();
            this._signals = [];
            this._dndSignals = [];
            this._dndMode = this._settings.get_int('dnd-mode');
            this._coloredIcons = this._settings.get_boolean('colored-icons');
            this._notificationCount = this._settings.get_boolean('notification-count');
            this._hideCountWhenOne = this._settings.get_boolean('hide-count-when-one');
            this._iconSize = this._settings.get_int('icon-size');
            this._isDndActive = false;
            this._sourceIdCounter = 0;
            this._sourceIdMap = new WeakMap();

            this._connectSignals();
            this._updateDndState();
            this._updateAllSources();
        }

        _connectSignals() {
            this._signals = [
                Main.messageTray.connect('source-added', this._onSourceAdded.bind(this)),
                Main.messageTray.connect('source-removed', this._onSourceRemoved.bind(this)),
            ];

            this._monitorDndState();
        }

        _getSourceId(source) {
            if (source._policy && source._policy.id) {
                return `policy:${source._policy.id}`;
            }

            if (source.app && source.app.get_id) {
                return `app:${source.app.get_id()}`;
            }

            if (source.title) {
                return `title:${source.title}`;
            }

            if (!this._sourceIdMap.has(source)) {
                this._sourceIdMap.set(source, `generated:${this._sourceIdCounter++}`);
            }
            return this._sourceIdMap.get(source);
        }

        _onSourceAdded(tray, source) {
            if (!source) {
                return;
            }

            const sourceId = this._getSourceId(source);

            if (!this._shouldShowInDND(source)) {
                return;
            }

            if (!this._icons.has(sourceId)) {
                const icon = this._createIcon(source);
                this._icons.set(sourceId, icon);
                this.add_child(icon._widget);
            }
        }

        _onSourceRemoved(tray, source) {
            if (!source) {
                return;
            }

            const sourceId = this._getSourceId(source);

            const icon = this._icons.get(sourceId);
            if (icon) {
                this.remove_child(icon._widget);
                this._destroyIcon(icon);
                this._icons.delete(sourceId);
            }
        }

        _createIcon(source) {
            const iconSizeMap = [16, 18, 20];
            const actualIconSize = iconSizeMap[this._iconSize] || 18;
            const gicon = this._getGIconForSource(source);
            const iconName = gicon ? null : this._getIconNameForSource(source);

            const icon = new Icon(
                source,
                actualIconSize,
                gicon,
                iconName,
                this._coloredIcons,
                this._notificationCount,
                this._hideCountWhenOne
            );

            return icon;
        }

        _getGIconForSource(source) {
            if (source.notifications && source.notifications.length > 0) {
                for (const notification of source.notifications) {
                    if (notification.gicon) {
                        return notification.gicon;
                    }
                }
            }

            if (source.icon && source.icon instanceof Gio.Icon) {
                return source.icon;
            }

            if (source.app && source.app.get_icon) {
                const appIcon = source.app.get_icon();
                if (appIcon) {
                    return appIcon;
                }
            }

            if (source.gicon && source.gicon instanceof Gio.Icon) {
                return source.gicon;
            }

            return null;
        }

        _getIconNameForSource(source) {
            if (source.notifications && source.notifications.length > 0) {
                for (const notification of source.notifications) {
                    if (notification.gicon && notification.gicon instanceof Gio.ThemedIcon) {
                        const names = notification.gicon.get_names();
                        if (names && names.length > 0) {
                            return names[0];
                        }
                    }

                    if (notification.iconName) {
                        return notification.iconName;
                    }
                }
            }
            
            if (source.icon && source.icon instanceof Gio.ThemedIcon) {
                const names = source.icon.get_names();
                if (names && names.length > 0) {
                    return names[0];
                }
            }
            if (source.iconName) {
                return source.iconName;
            }
            
            if (source.app && source.app.get_id) {
                const appId = source.app.get_id();
                if (appId) {
                    const iconName = appId.replace(/\.desktop$/, '');
                    return iconName;
                }
            }

            if (source.title) {
                const lowerTitle = source.title.toLowerCase().replace(/\s+/g, '-');
                return lowerTitle;
            }

            return 'notification-symbolic';
        }


        _monitorDndState() {
            const settings = new Gio.Settings({ schema_id: 'org.gnome.desktop.notifications' });

            this._dndSignals = [
                settings.connect('changed::show-banners', this._onDndStateChanged.bind(this))
            ];

            this._dndSettings = settings;
            this._updateDndState();
        }

        _updateDndState() {
            const wasDndActive = this._isDndActive;

            if (this._dndSettings) {
                this._isDndActive = !this._dndSettings.get_boolean('show-banners');
            } else {
                const settings = new Gio.Settings({ schema_id: 'org.gnome.desktop.notifications' });
                this._isDndActive = !settings.get_boolean('show-banners');
            }

            if (wasDndActive !== this._isDndActive) {
                this._updateAllSources();
            }
        }

        _onDndStateChanged() {
            this._updateDndState();
        }

        _shouldShowInDND(source) {
            if (!this._isDndActive) {
                return true;
            }

            const dndMode = this._settings.get_int('dnd-mode');

            switch (dndMode) {
                case 0:
                    return true;
                case 1:
                    return this._isUrgentNotification(source);
                case 2:
                    return false;
                default:
                    return true;
            }
        }

        _isUrgentNotification(source) {
            if (!source) {
                return false;
            }

            if (source.notifications && source.notifications.length > 0) {
                return source.notifications.some(notification => {
                    if (notification._urgency === 2 || notification._urgency === 3) {
                        return true;
                    }
                    if (notification.urgency === MessageTray.Urgency.CRITICAL ||
                        notification.urgency === MessageTray.Urgency.HIGH) {
                        return true;
                    }
                    return false;
                });
            }

            return false;
        }

        _updateAllSources() {
            this.remove_all_children();
            this._icons.forEach(icon => this._destroyIcon(icon));
            this._icons.clear();

            const sources = Main.messageTray.getSources();
            sources.forEach(source => this._onSourceAdded(null, source));
        }

        _destroyIcon(icon) {
            if (icon._signal) {
                icon._source.disconnect(icon._signal);
            }
            icon._widget.destroy();
        }

        updateSettings() {
            const newDndMode = this._settings.get_int('dnd-mode');
            const newColoredIcons = this._settings.get_boolean('colored-icons');
            const newNotificationCount = this._settings.get_boolean('notification-count')
            const newHideCountWhenOne = this._settings.get_boolean('hide-count-when-one');
            const newIconSize = this._settings.get_int('icon-size');

            let needsUpdate = false;

            if (newDndMode !== this._dndMode) {
                this._dndMode = newDndMode;
                needsUpdate = true;
            }

            if (newColoredIcons !== this._coloredIcons) {
                this._coloredIcons = newColoredIcons;
                needsUpdate = true;
            }

            if (newNotificationCount !== this._notificationCount) {
                this._notificationCount = newNotificationCount;
                needsUpdate = true;
            }

            if (newHideCountWhenOne !== this._hideCountWhenOne) {
                this._hideCountWhenOne = newHideCountWhenOne;
                needsUpdate = true;
            }

            if (newIconSize !== this._iconSize) {
                this._iconSize = newIconSize;
                needsUpdate = true;
            }

            if (needsUpdate) {
                this._updateAllSources();
            }
        }

        destroy() {
            if (this._signals) {
                this._signals.forEach(signal => {
                    if (signal) {
                        Main.messageTray.disconnect(signal);
                    }
                });
                this._signals = [];
            }

            if (this._dndSignals && this._dndSettings) {
                this._dndSignals.forEach(signal => {
                    if (signal) {
                        this._dndSettings.disconnect(signal);
                    }
                });
                this._dndSignals = [];
                this._dndSettings = null;
            }

            this._icons.forEach(icon => this._destroyIcon(icon));
            this._icons.clear();
            super.destroy();
        }
    }
);
