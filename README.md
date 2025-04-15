# t-rex 
Template Resolver Engine Xtreme

## Features

t-rex is a template engine that is
- extremely easy to use
- extremely easy to debug
- extremely flexible
- extremely robust
- extremely tiny

and unbelievable fast.

## Installation

```bash
npm install t-rex4js
```

## Hello world

```js
(async () => {
    const { tRex } = await import('t-rex4js')

    const content = tRex({
        id: 'myRootTemplate',
        main: (t) => t.hello() + ' ' + t.world(),
        hello: 'Hello',
        world: 'world!',
    })
    
    console.log(content)
})()
```

## Architecture and user interface

t-rex is heavily inspired by [block-inheritance-templating](https://github.com/Koudela/block-inheritance-templating)
but uses a much cleaner more simplified user interface and architecture.

### Template and context chain

For every template rendering the user has to pass a template chain and a context
chain. Both are basically objects with an `id` which may have a `parent` property 
pointing to a parent object. As each parent can have a parent of its own it can be 
seen as chain.

The template chain holds all the general rendering information and the context chain
all the variable rendering information.

The chains are traversed from the root to parent, to parent, to parent until the
property is found. Thus, a template or context always overwrites the property 
of its parent.

(It is roughly the same concept as the prototype chain of javascript objects.)

### Properties

Properties of the template chain and the context chain are basically the same. They
can be seen as template blocks/components, data providers and template extensions 
in union.

Properties are looked up in the context chain first using the template chain as 
fallback. Thus, the template chain can provide default values and the context chain
can overwrite template extensions and data providers.

Properties can have all values a javascript object property can hold. They are
always called via a function call `await t.propertyName()` even if they hold a string,
number, boolean, object or `null`. 

`debug`, `parent` and `iterate` are reserved words and cannot be used as properties.

### Callable properties

Properties holding a function are special. Instead of returning the property the
function will be called with the template proxy and the passed properties:

`t.propertyName(...props)` will result in a call of

```js
{
    //...
    propertyName: (t, ...props) => {
        //...
    }
    //...
}
```

As there is no context scope a good practice is to retrieve the unscoped data via
the context, but pass scoped data to the other callable properties via the parameters 
of the property call.

## Special proxy functions

### t.parent

The `parent` call is a special call to target the parent. It can be used to call 
the current property name on the parent provider. The remaining provider chain is 
respected by this call. If the first parameter is not `null` the `parent` call is 
not targeted at the immediate parent but the remaining chain is traversed (without
property search) until a provider with the given id is found.

All remaining parameters have to be passed explicitly, too: `t.parent(startingId, ...params)`

### t.iterate

The `iterate` call is a special call to iterate over any finite iterable.

```js
t.iterate('propertyName', iterable, ...params)
```

It iterates over the following call:

```js
t.propertyName(value, index, arr, ...params)
```

Where `arr` is the array from the iterable.

## Special properties

### 404

If a property is neither found in the context chain nor in the template chain the
404 property is called with the template proxy first and the missing property name
second, the start provider id third, followed by the parameters. You can use this 
to handle missing properties.

If there is no 404 property the template engine throws an error instead.

The default attaches the rendering stack trace to the error message.

### 500

Whenever an error occurs in a property function the 500 property is called with 
the template proxy first, the current property name second and the error object 
third, followed by the parameters. You can use this to handle errors.

The default attaches the rendering stack trace to the error message.

## Render a template

First import the t-rex function with:

```js
const { tRex } = await import('t-rex4js')
```

or

```js
import { tRex } from 't-rex4js'
```

then use it:

```js
const template = { 
    //... 
}
const context = {
    //... 
}
const entrypoint = 'main'

const output = await tRex(template, context, entrypoint)
```

## Async and await

Whenever possible `t.propertyName()` returns without a Promise. If the executet template and context code does not trigger a Promise you can even call `tRex` without an `await`. 

## Debugging a template

`t.debug()` will give access to the current debug instance of the template engine. 
Thus, you have access to the parameters passed to the `tRex` function. You can print 
the template/context call stack and set the debugMarks property to `true` or `false`.

```js
const debug = t.debug()
debug.template                    // root template
debug.context                     // root context
debug.entrypoint                  // entrypoint
debug.printStack()                // returns the rendering stack trace
debug.debugMarks = true || false  // switch debugging marks on or off
```

### Using debugging marks

Debugging marks are information added to the template output. They hint where the
output comes from. They have the following syntax:

```html
<!--propertyName@templateId-->
content generated by the property with propertyName 
in the template with the id templateId
<!--\propertyName@templateId-->
```

Debugging marks are only added to string properties and property functions returning
a string. 

You can use the `debugMarks` property of the debug instance to turn debugging marks 
on and off. 

```js
t.debug().debugMarks = true  // turns debugging marks on locally
await t.content()            // debugging marks are added to the output of t.content()
t.debug().debugMarks = false // turns debugging marks off locally
```

Be carefull if you use async code. If you turn debugging marks on
and off in different function calls, the behaviour may not be predictable.

You can pass the `debugMarks` parameter to the `tRex` function, too.

```js
await tRex(template, context, entrypoint, true) // turns debugging marks on from the start
```

Be aware that activation may introduce bugs as string processing in the user-land 
functions may be affected by the additional string content.

## Basic Example

```js
const { tRex } = await import('t-rex4js')

const parentTemplate = {
    id: 'myParentTemplate',
    parent: null,
    main: (t) => {
        return `<!doctype html>
<html lang="en">
<head>
    <title>${ t.title() }</title>
    ${ t.head() }
</head>
<body>
    ${ t.nav() }
    <h1>${ t.title() }</h1>
    ${ t.content() }
</body>
</html>`
    },
    head: function() {
        return `<script>let that, be, empty</script>`
    },
}

const renderedTemplate = {
    id: 'myTemplate',
    parent: parentTemplate,
    nav: (t) => {
        return `
    <nav>${ t.iterate('navItemBlock', t.navItems()).join('') }
    </nav>`
    },
    navItemBlock: (t, value, index, original) => {
        return `
        <a href="${ value.href }">(${ index }) ${ value.content }</a>`
    },
}

const context = {
    id: 'myContext',
    content: '<p>some content</p>',
    title: 'Hello World', 
    navItems: [
        { href: 'https://hello.com', content: 'hugs to you' },
        { href: 'https://world.com', content: 'global issues' },
    ],
}

const output = tRex(renderedTemplate, context, 'main');

// console.log(output) gives:
//
// <!doctype html>
// <html lang="en">
// <head>
//     <title>Hello World</title>
//     <script>let that, be, empty</script>
// </head>
// <body>
//     
//     <nav>
//         <a href="https://hello.com">(0) hugs to you</a>
//         <a href="https://world.com">(1) global issues</a>
//     </nav>
//     <h1>Hello World</h1>
//     <p>some content</p>
// </body>
// </html>
```

## Adding functionality

The best place to add global functionality is to use a base template object all 
template chains end in. If you need functionality only in a specific template add 
it to its template object. Functionality that is bound to the context should be 
placed there.

### Add caching example

To add caching functionality you can use your favorite caching provider. Add a `cache`
property to your base template object:

```js
import { getCache, setCache, hasCache } from 'favorite/cache-provider'

const baseTemplate = {
    id: 'baseTemplate',
    //...
    cache: async (t, key, providerFunction) => {
        if (hasCache(key)) return getCache(key)
        
        const content = await providerFunction()
        
        setCache(key, content)
        
        return content
    },
    //...
}
```

Now you can use it in all your template and context chains:

```js
const someTemplate = {
    //...
    someComponent: async (t, key, ...otherParams) => {
        return t.cache(key, () => {
            //...
            // generate the content
            //...
            return content;
        })
    },
    //...
}
```

### Add additional css example

To add additional css, we have to collect it and add it to the html. Thus, we need
two types of functionality: `addAdditionalCss` and `getAdditionalCss`.

```js
const additionalCss = []

const baseTemplate = {
    id: 'baseTemplate',
    //...
    addAdditionalCss: (t, css) => {
        additionalCss.push(css)
    },
    getAdditionalCss: () => {
        return additionalCss.join('')
    },
    //...
}
```

**The above code is full of side effects.** We can do better by using the context:

```js
const baseTemplate = {
    id: 'baseTemplate',
    //...
    addAdditionalCss: (t, css) => {
        const data = t.tmpData()
        if ('additionalCss' in data) data.additionalCss.push(css)
        else data.additionalCss = [css]
    },
    getAdditionalCss: (t) => {
        return t.tmpData().additionalCss?.join('') ?? ''
    },
    //...
}
//...
const content = await tRex(template, { id:"individualContext", tmpData: {}, parent:localContext })
//...
```

This works as expected, but make sure to use a context factory in production code.

We have to take care that the collecting is finished once we add it.

```js
const baseTemplate = {
    id: 'baseTemplate',
    //...
    main: async (t) => {
        const parts = [
            t.title(),
            t.head(),
            t.body(),
        ]
        
        await Promise.all(parts)
        
        return `<!doctype html>
<html lang="en">
<head>
    <title>${ await parts[0] }</title>
    ${ await parts[1] }
    <style>${ t.getAdditionalCss() }</style>
</head>
<body>
    ${ await parts[2] }
</body>
</html>`
    }
    //...
}
```

Now we can add css to our output:

```js
const someTemplate = {
    //...
    someComponent: async (t, ...params) => {
        t.addAdditionalCss(`
            //... some lines of css
        `)
        // the other code of the component/block
    },
    //...
}
```