# Top Panel Notification Icons Revived

A GNOME Shell extension that displays notification icons in the top panel, providing quick access to active notifications without opening the notification center.

## Features

- **Notification Icons**: Shows icons for active notification sources in the top panel
- **Configurable Position**: Place icons on the left or right side of the clock
- **Icon Styling**: Toggle between colored and symbolic (monochrome) icons
- **Icon Size**: Choose from small (16px), medium (18px), or large (20px) icons
- **Do Not Disturb Support**: Configure behavior when DND mode is active
  - Always show icons (shows all notification icons regardless of DND)
  - Show only urgent notifications (shows only critical/urgent notifications when DND is on)
  - Never show icons (hides all notification icons when DND is on)


## Installation

### From GNOME Extensions Website (Recommended)

Install from [GNOME Shell extension page](https://extensions.gnome.org/extension/6248/top-panel-notification-icons-revived/)

### Manual Installation

Use the provided Makefile for easy installation:

```bash
# Install the extension
make install

# Or simply run make (same as make install)
make
```



## Configuration

Access the extension preferences through GNOME Extensions app or run:
```bash
gnome-extensions prefs notification-icons@muhammad_ans.github
```

### Settings

- **Icon Size**: Choose the size of notification icons (Small/Medium/Large)
- **Colored Icons**: Toggle between colored and symbolic icons
- **Right Side**: Position icons on the right side of the clock
- **Do Not Disturb Mode**: Control icon visibility when DND is active


## Compatibility

- GNOME Shell versions: 45, 46, 47, 48
- Tested on GNOME 45+

## Development

This extension is a fork and revival of the original [top-panel-notification-icons](https://github.com/5th0/top-panel-notification-icons) project, updated for modern GNOME versions with improved features and code quality.
