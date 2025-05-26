# Joplin Plugin - Click-to-Copy Spans

This Joplin plugin allows you to create inline click-to-copy text spans. 

**Version**: 1.0

## Installation

- Open Joplin and navigate to `Preferences > Plugins`
- Search for `click-to-copy` and click install
- Restart Joplin

### Uninstall

- Open Joplin and navigate to `Tools > Options > Plugins`
- Search for `Click-to-copy` plugin
- Press `Delete` to remove the plugin or `Disable` to disable it
- Restart Joplin

## Usage

### Click-to-copy spans

In order to create a collapsible block, you can:
- press on the `Click-to-Copy Span` toolbar button to create a template span, or
- highlight text then press on the `Click-to-Copy Span` toolbar button to convert it to a span, or
- or manually type in the following format:

```
[[insert text here]]
```

You can additionally make the text within the span render as inline code by wrapping the entire contents of the span in backticks, like so:

```
[[`This will render as inline code, but still be click-to-copy`]]
```

## Custom styles

If you would like to style the collapsible blocks to your preference, use the following in your `userstyle.css` file, which can be accessed in `Joplin` → `Options` → `Appearance` → `Show Advanced Settings` → `Custom stylesheet for rendered Markdown`:

```css
/* Styling of the click-to-copy spans */
.ctc {

}
```

## Settings
There is a settings page for the plugin in the Joplin options. There, you can customize the start and end tokens away from the default `[[` and `]]`. 

## Notes

- **There might be bugs**, [report them here](https://github.com/ntczkjfg/joplin-plugin-click-to-copy-span/issues) and I'll try to fix them if I can.

## Acknowledgement

Thanks to the creator of the [Joplin Spoilers](https://github.com/martinkorelic/joplin-plugin-spoilers) plugin, whose code helped me build this plugin. 