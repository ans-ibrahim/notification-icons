/* extension.js
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 2 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
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
        try {
            this._settings = this.getSettings();
            this._topbarNotification = new TopbarNotification(this._settings);
            
            // Connect to settings changes
            this._signals = [
                this._settings.connect('changed::right-side', this._onSettingsChanged.bind(this)),
                this._settings.connect('changed::colored-icons', this._onSettingsChanged.bind(this)),
                this._settings.connect('changed::dnd-mode', this._onSettingsChanged.bind(this)),
                this._settings.connect('changed::icon-size', this._onSettingsChanged.bind(this)),
            ];

            this._insertNotificationWidget();
        } catch (error) {
            console.error(`[TopbarNotificationIcons] Failed to enable extension: ${error.message}`);
        }
    }

    disable() {
        try {
            // Disconnect signals
            if (this._signals) {
                this._signals.forEach(signal => {
                    if (signal) {
                        this._settings.disconnect(signal);
                    }
                });
                this._signals = [];
            }

            // Destroy notification widget
            if (this._topbarNotification) {
                this._topbarNotification.destroy();
                this._topbarNotification = null;
            }

            this._settings = null;
        } catch (error) {
            console.error(`[TopbarNotificationIcons] Failed to disable extension: ${error.message}`);
        }
    }

    _onSettingsChanged() {
        try {
            // Update the notification widget with new settings
            if (this._topbarNotification) {
                this._topbarNotification.updateSettings();
                this._repositionWidget();
            }
        } catch (error) {
            console.error(`[TopbarNotificationIcons] Failed to handle settings change: ${error.message}`);
        }
    }

    _insertNotificationWidget() {
        try {
            const dateMenu = Main.panel.statusArea.dateMenu;
            if (!dateMenu || !dateMenu._clockDisplay) {
                throw new Error('Date menu or clock display not found');
            }

            const rightSide = this._settings.get_boolean('right-side');
            const container = dateMenu.get_first_child();
            
            if (rightSide) {
                container.insert_child_above(this._topbarNotification, dateMenu._clockDisplay);
            } else {
                container.insert_child_below(this._topbarNotification, dateMenu._clockDisplay);
            }
        } catch (error) {
            console.error(`[TopbarNotificationIcons] Failed to insert notification widget: ${error.message}`);
        }
    }

    _repositionWidget() {
        try {
            const dateMenu = Main.panel.statusArea.dateMenu;
            if (!dateMenu || !dateMenu._clockDisplay) {
                return;
            }

            const rightSide = this._settings.get_boolean('right-side');
            const container = dateMenu.get_first_child();
            
            // Remove and reinsert to change position
            container.remove_child(this._topbarNotification);
            
            if (rightSide) {
                container.insert_child_above(this._topbarNotification, dateMenu._clockDisplay);
            } else {
                container.insert_child_below(this._topbarNotification, dateMenu._clockDisplay);
            }
        } catch (error) {
            console.error(`[TopbarNotificationIcons] Failed to reposition widget: ${error.message}`);
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
            this._icons = new Map(); // Track icons by source ID
            this._signals = [];
            this._dndSignals = [];
            this._dndMode = this._settings.get_int('dnd-mode');
            this._coloredIcons = this._settings.get_boolean('colored-icons');
            this._iconSize = this._settings.get_int('icon-size');
            this._isDndActive = false;

            this._connectSignals();
            this._updateDndState();
            this._updateAllSources();
        }

        _connectSignals() {
            this._signals = [
                Main.messageTray.connect('source-added', this._onSourceAdded.bind(this)),
                Main.messageTray.connect('source-removed', this._onSourceRemoved.bind(this)),
            ];

            // Monitor DND state changes
            this._monitorDndState();
        }

        _onSourceAdded(tray, source) {
            
            try {
                if (!source || !source._policy || source._policy.id === 'generic') {
                    return;
                }

                const sourceId = source._policy.id;
                
                // Check DND mode
                if (!this._shouldShowInDND(source)) {
                    return;
                }

                if (!this._icons.has(sourceId)) {
                    const icon = this._createIcon(source);
                    this._icons.set(sourceId, icon);
                    this.add_child(icon);
                }
            } catch (error) {
                console.error(`[TopbarNotificationIcons] Failed to add source: ${error.message}`);
            }
        }

        _onSourceRemoved(tray, source) {
            try {
                if (!source || !source._policy) {
                    return;
                }

                const sourceId = source._policy.id;
                
                const icon = this._icons.get(sourceId);
                if (icon) {
                    this.remove_child(icon);
                    this._icons.delete(sourceId);
                }
            } catch (error) {
                console.error(`[TopbarNotificationIcons] Failed to remove source: ${error.message}`);
            }
        }

        _createIcon(source) {
            // Map icon size setting to actual pixel values
            const iconSizeMap = [16, 18, 20];
            const actualIconSize = iconSizeMap[this._iconSize] || 18;
            
            const icon = new St.Icon({
                icon_name: source._policy.id,
                icon_size: actualIconSize,
                style_class: 'topbar-notification-icon',
            });

            // Apply styling based on settings
            if (!this._coloredIcons) {
                icon.add_style_class_name('app-menu-icon');
                icon.add_effect(new Clutter.DesaturateEffect());
            }

            // Add click handler to show notification
            icon.connect('button-press-event', () => {
                this._onIconClicked(source);
                return Clutter.EVENT_STOP;
            });

            return icon;
        }

        _onIconClicked(source) {
            try {
                // Show the notification source
                if (source && source.showBanner) {
                    source.showBanner();
                }
            } catch (error) {
                console.error(`[TopbarNotificationIcons] Failed to handle icon click: ${error.message}`);
            }
        }

        _monitorDndState() {
            try {
                // Monitor DND state changes using GSettings
                const Gio = imports.gi.Gio;
                const settings = new Gio.Settings({ schema_id: 'org.gnome.desktop.notifications' });
                
                this._dndSignals = [
                    settings.connect('changed::show-banners', this._onDndStateChanged.bind(this))
                ];
                
                // Store settings reference
                this._dndSettings = settings;
                
                // Initial DND state
                this._updateDndState();
            } catch (error) {
                console.error(`[TopbarNotificationIcons] Failed to monitor DND state: ${error.message}`);
                // Fallback: don't monitor DND if it fails
                this._dndSignals = [];
            }
        }

        _updateDndState() {
            try {
                const wasDndActive = this._isDndActive;
                
                // Check DND state using GSettings
                if (this._dndSettings) {
                    this._isDndActive = !this._dndSettings.get_boolean('show-banners');
                } else {
                    // Fallback: check directly
                    const Gio = imports.gi.Gio;
                    const settings = new Gio.Settings({ schema_id: 'org.gnome.desktop.notifications' });
                    this._isDndActive = !settings.get_boolean('show-banners');
                }
                
                // If DND state changed, update all sources
                if (wasDndActive !== this._isDndActive) {
                    this._updateAllSources();
                }
            } catch (error) {
                console.error(`[TopbarNotificationIcons] Failed to update DND state: ${error.message}`);
                // Fallback: assume DND is not active
                this._isDndActive = false;
            }
        }

        _onDndStateChanged() {
            this._updateDndState();
        }

        _shouldShowInDND(source) {
            // If DND is not active, always show
            if (!this._isDndActive) {
                return true;
            }

            const dndMode = this._settings.get_int('dnd-mode');
            
            switch (dndMode) {
                case 0: // Always
                    return true;
                case 1: // Urgent only
                    return this._isUrgentNotification(source);
                case 2: // Never
                    return false;
                default:
                    return true;
            }
        }

        _isUrgentNotification(source) {
            try {
                if (!source || !source._policy) {
                    return false;
                }

                // Check if the source has any urgent notifications
                if (source.notifications && source.notifications.length > 0) {
                    return source.notifications.some(notification => {
                        if (notification._urgency === 2) {
                            return true; // Critical urgency - always show
                        }
                        
                        return false;
                    });
                }


                return false;
            } catch (error) {
                console.error(`[TopbarNotificationIcons] Failed to check urgent notification: ${error.message}`);
                return false;
            }
        }

        _updateAllSources() {
            try {
                this.remove_all_children();
                this._icons.clear();

                const sources = Main.messageTray.getSources();
                sources.forEach(source => this._onSourceAdded(null, source));
            } catch (error) {
                console.error(`[TopbarNotificationIcons] Failed to update all sources: ${error.message}`);
            }
        }

        updateSettings() {
            try {
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
            } catch (error) {
                console.error(`[TopbarNotificationIcons] Failed to update settings: ${error.message}`);
            }
        }

        destroy() {
            try {
                // Disconnect message tray signals
                if (this._signals) {
                    this._signals.forEach(signal => {
                        if (signal) {
                            Main.messageTray.disconnect(signal);
                        }
                    });
                    this._signals = [];
                }

                // Disconnect DND signals
                if (this._dndSignals && this._dndSettings) {
                    this._dndSignals.forEach(signal => {
                        if (signal) {
                            this._dndSettings.disconnect(signal);
                        }
                    });
                    this._dndSignals = [];
                    this._dndSettings = null;
                }

                // Clear icons map
                this._icons.clear();

                super.destroy();
            } catch (error) {
                console.error(`[TopbarNotificationIcons] Failed to destroy widget: ${error.message}`);
            }
        }
    }
);


