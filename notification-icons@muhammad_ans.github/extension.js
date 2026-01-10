import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as MessageTray from 'resource:///org/gnome/shell/ui/messageTray.js';
import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';
import St from 'gi://St';
import Gio from 'gi://Gio';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

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
                this._icons.set(sourceId, { icon, source });
                this.add_child(icon);
            }
        }

        _onSourceRemoved(tray, source) {
            if (!source) {
                return;
            }

            const sourceId = this._getSourceId(source);

            const entry = this._icons.get(sourceId);
            if (entry) {
                this.remove_child(entry.icon);
                this._icons.delete(sourceId);
            }
        }

        _createIcon(source) {
            const iconSizeMap = [16, 18, 20];
            const actualIconSize = iconSizeMap[this._iconSize] || 18;

            let gicon = this._getGIconForSource(source);
            let iconName = null;

            if (!gicon) {
                iconName = this._getIconNameForSource(source);
            }

            const icon = new St.Icon({
                icon_size: actualIconSize,
                style_class: 'topbar-notification-icon',
            });

            if (gicon) {
                icon.gicon = gicon;
            } else {
                icon.icon_name = iconName || 'notification-symbolic';
            }
            if (!this._coloredIcons) {
                icon.add_style_class_name('app-menu-icon');
                icon.add_effect(new Clutter.DesaturateEffect());
            }


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
            this._icons.clear();

            const sources = Main.messageTray.getSources();
            sources.forEach(source => this._onSourceAdded(null, source));
        }

        updateSettings() {
            const newDndMode = this._settings.get_int('dnd-mode');
            const newColoredIcons = this._settings.get_boolean('colored-icons');
            const newIconSize = this._settings.get_int('icon-size');

            let needsUpdate = false;

            if (newDndMode !== this._dndMode) {
                this._dndMode = newDndMode;
                needsUpdate = true;
            }

            if (newColoredIcons !== this._coloredIcons || newIconSize !== this._iconSize) {
                this._coloredIcons = newColoredIcons;
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

            this._icons.clear();
            super.destroy();
        }
    }
);