# TODO

## DOM support

- Shadow DOM/web components
- `iframe`s
- `textarea`, `input`, `placeholder` attr (?)

## Better whitespace handling

- `display: block` and similar = newline before and after
- `<p>` = two newlines before and after
- `<br>` = newline
- `display: inline` and variants = no additional space
- `display: table-cell` = tab before and after
- Collapse whitespace within text nodes unless `white-space: pre` or similar is set
- `display: flex` and `display: grid` = space between children (?)

For example:

```html
<p>
	one <span>two
	</span> three<br>four
</p>
```

Should logically render as:

```
one two three
four
```

`innerText` may be a place to start:

- However, less easy to resolve to/from DOM nodes compared to `textContent`
- Text nodes have no `innerText`, only `nodeValue`/`data` (corresponding to `textContent`)
- Offsets within `range` are relative to `textContent`, not `innerText`

See [The poor, misunderstood innerText — Perfection Kills § The naive spec](http://perfectionkills.com/the-poor-misunderstood-innerText/#naive-spec) for a possible implementation.
