# Loader

Load external files.

## Examples

Print to stdout
```shell
node src/cli.js test/in.json
```

Write to file
```shell
node src/cli.js test/in.json out.json
```

## Status
Synchronous, not caching, no tests. Bad.

## TODO

* Support nested files

## Input

Objects with type "include" will read the "resolvedVal" attribute and replace the object.

```json
[
  {
    "source": "full_path/includes.pug",
    "type": "include",
    "val": "auxiliary/mixins.pug",
    "resolvedVal": "full_path/auxiliary/mixins.pug",
    "lineNumber": 2
  },
  {
    "source": "full_path/includes.pug",
    "type": "mixin_call",
    "name": "foo",
    "lineNumber": 4
  },
  {
    "source": "full_path/includes.pug",
    "name": "body",
    "type": "tag",
    "lineNumber": 6,
    "children": [
      {
        "source": "full_path/includes.pug",
        "type": "include",
        "val": "auxiliary/smile.html",
        "resolvedVal": "full_path/auxiliary/smile.html",
        "lineNumber": 7
      },
      {
        "source": "full_path/includes.pug",
        "type": "include",
        "val": "auxiliary/escapes.html",
        "resolvedVal": "full_path/auxiliary/escapes.html",
        "lineNumber": 8
      },
      {
        "source": "full_path/includes.pug",
        "name": "script",
        "type": "tag",
        "attrs": [
          {
            "name": "type",
            "val": "\"text/javascript\""
          }
        ],
        "lineNumber": 9,
        "children": [
          {
            "source": "full_path/includes.pug",
            "type": "text",
            "val": "include:verbatim auxiliary/includable.js",
            "lineNumber": 10
          }
        ]
      }
    ]
  }
]
```

## Failing files
16 failing:

* filters.include.custom.err
* filters.include.err
* include-extends-from-root.err
* include-extends-relative.err
* includes-with-ext-js.err
* inheritance.extend.recursive.err
* layout.append.err
* layout.append.without-block.err
* layout.multi.append.prepend.block.err
* layout.prepend.err
* layout.prepend.without-block.err
* mixin-via-include.err
* mixin.attrs.err
* mixins.err
* tags.self-closing.err
* xml.err (expected)

12 are missing files

4 have unexpected end of JSON. I believe there are 4 files that are currently failing the previous step, so that would account for these 4 files.