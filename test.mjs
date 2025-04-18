/**
 * t-rex
 * Template Resolver Engine Xtreme
 *
 * @package t-rex4js
 * @link https://github.com/Koudela/t-rex/
 * @copyright Copyright (c) 2025 Thomas Koudela
 * @license http://opensource.org/licenses/MIT MIT License
 */

import test from 'ava'
import { tRex } from './index.mjs'

test('Hello world', async t => {
    const content = tRex({
        id: 'myRootTemplate',
        main: (t) => t.hello() + ' ' + t.world(),
        hello: 'Hello',
        world: 'world!',
    })
    
    t.is(content, `Hello world!`)
})

test('Properties', async t => {
    const result = tRex({
        id: 'rT',
        rTProperty: null,
        parent: {
            id: 'pT',
            pTProperty: true,
            parent: {
                ppTProperty: [1, 2, 3],
                id: 'ppT',
            },
        },
    }, {
        id: 'rC',
        rCProperty: { key: 'value' },
        parent: {
            id: 'pC',
            pCProperty: 'value',
            parent: {
                id: 'ppC',
                ppCProperty: 4.2,
            },
        },
        main: (t) => ({
            a: t.rTProperty(),
            b: t.pTProperty(),
            c: t.ppTProperty(),
            d: t.rCProperty(),
            e: t.pCProperty(),
            f: t.ppCProperty(),
        })
    })
    t.deepEqual(result, { a: null, b: true, c: [1, 2, 3], d: { key: 'value'}, e: 'value', f: 4.2 })
})

test('Callable properties', async t => {
    await tRex({
        id: 'rT',
        callableProperty: async (lambda, ...props) => {
            t.deepEqual(props, [42, true, 'value'])
        },
        main: async (t) => {
            await t.callableProperty(42, true, 'value')
        },
    })
})

const template = {
    id: 'rootTemplate',
    parent: {
        id: 'parentTemplate',
        parentCall: () => `rootTemplateParentCall`,
    },
    parentCall: (t) => t.parent()
}
const context = {
    id: 'rootContext',
    parent: {
        id: 'parentContext',
    },
    contextParentCall: (t) => t.parent(),
}

test('t.parent call in template', async t => {
    const result = tRex(template, context, 'parentCall')
    t.is(result, 'rootTemplateParentCall')
})

test('t.parent call in context', async t => {
    try {
        tRex(template, context, 'contextParentCall')
        t.fail()
    } catch (e) {
        t.is(e.message, '"Resource \'contextParentCall\' not found for start provider id \'parentContext\'." tRex stack: [contextParentCall@rootContext]')
    }
})

test('t.parent call in context with id', async t => {
    const template = {
        id: 'rT',
        main: async () => {
            return 'FAILURE'
        },
        parent: {
            id: 'pT',
            parent: {
                id: 'ppT',
                main: async () => {
                    return 'SUCCESS'
                },
            },
        },
    }
    const context = {
        id: 'rC',
        main: async (t) => {
            return await t.parent('pT')
        },
    }
    const result = await tRex(template, context, 'main')
    t.is(result, 'SUCCESS')
})

test('t.parent call in context with not existing id', async t => {
    const template = {
        id: 'rT',
        main: () => {
            return 'FAILURE'
        },
    }
    const context = {
        id: 'rC',
        main: (t) => {
            return t.parent('pT')
        },
    }
    try {
        tRex(template, context, 'main')
    } catch (e) {
        t.is(e.message, '"Resource \'main\' not found." tRex stack: [main@rC]')
    }
})

test('t.iterate', async t => {
    const result = await tRex({
        id: 'rT',
        eta: (t, value, index, iterator, param) => value+`(${index})`+param,
        main: (t) => {
            return t.iterate('eta', ['x1', 'x2', 'x3'], 'y').join('|')
        }
    })
    t.is(result, 'x1(0)y|x2(1)y|x3(2)y')
})

test('404', async t => {
    try {
        await tRex({
            id: 'rT',
            main: async (t) => {
                return t.notFound()
            }
        })
    } catch (e) {
        t.is(e.message, '"Resource \'notFound\' not found." tRex stack: [main@rT]')
    }
    const result1 = await tRex({
        id: 'rT',
        404: async (t, ...params) => {
            return params
        },
        main: async (t) => {
            return t.notFound('Where is it?')
        }
    })
    t.deepEqual(result1, [
        'notFound',
        null,
        'Where is it?',
    ])
    const result2 = await tRex({
        id: 'rT',
        parent: {
            id: 'pT'
        },
        404: async (t, ...params) => {
            return params
        },
        main: async (t) => {
            return t.parent()
        }
    })
    t.deepEqual(result2, [
        'main',
        'pT',
    ])
})

test('500', async t => {
    try {
        await tRex({
            id: 'rT',
            main: async () => {
                throw Error('Hello!')
            }
        })
    } catch (e) {
        t.is(e.message, 'Hello! --> tRex stack: [main@rT]')
    }
    const result = await tRex({
        id: 'rT',
        500: async (t, ...params) => {
            return params
        },
        main: async () => {
            throw Error('Hello!')
        }
    })
    t.deepEqual(result, [
        'main',
        Error('Hello!'),
    ])
})

test('Debugging a template', async t => {
    const template = {
        id: 'rT',
        main: (t) => {
            const debug = t.debug()
            return [
                debug.contextChain,
                debug.templateChain,
                debug.entrypoint,
                debug.debugMarks,
                debug.printStack(),
            ]
        },
        debug: () => {
            throw Error('This must not be called!')
        }
    }
    const context = { id: 'rC' }
    const result = tRex(template, context, 'main', true)
    t.deepEqual(result, [
        context,
        template,
        'main',
        true,
        'main@rT',
    ])
})

test('Using debugging marks (global)', async t => {
    const result = await tRex({
        id: 'rT',
        string3: async () => 'value3',
        number3: async () => 3.14,
        arrayValue: [1, 2, 3],
        objectValue: { true: false },
        parent: {
            id: 'pT',
            nullValue: null,
            booleanValue: true,
        },
        main: async (t) => {
            return await t.string1() + await t.string2() + await t.string3()
                + await t.number1() + await t.number2() + await t.number3()
                + await t.nullValue() + await t.booleanValue() + await t.arrayValue()
                + await t.objectValue()

        },
    }, {
        id: 'rC',
        string2: 'value2',
        number2: 42,
        parent: {
            id: 'pC',
            string1: 'value1',
            number1: 2.3
        }
    }, 'main', true)
    t.is(result, '<!--main@rT--><!--string1@pC-->value1<!--\\string1@pC>--><!--string2@rC-->value2<!--\\string2@rC>--><!--string3@rT-->value3<!--\\string3@rT>-->2.3423.14nulltrue1,2,3[object Object]<!--\\main@rT>-->')
})

test('Using debugging marks (local)', async t => {
    const result = await tRex({
        id: 'rT',
        step1: async (t) => {
            return 'step1'+await t.step2()
        },
        parent: {
            id: 'pT',
            step2: async (t) => {
                return 'step2'+await t.step3()+'step2'
            }
        },
        main: async (t) => {
            return t.step1()
        },
    }, {
        id: 'rC',
        step3: async (t) => {
            t.debug().debugMarks = true
            const content = 'step3'+await t.step4()+'step3'
            t.debug().debugMarks = false
            return content
        },
        parent: {
            id: 'pC',
            step4: async (t) => {
                return 'step4'+await t.step5()+'step4'
            },
            step5: async () => {
                return 'step5'
            }
        }
    }, 'main')
    t.is(result, 'step1step2step3<!--step4@pC-->step4<!--step5@pC-->step5<!--\\step5@pC>-->step4<!--\\step4@pC>-->step3step2')
})

test('Basic example', async t => {
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
    
    t.is(output, `<!doctype html>
<html lang="en">
<head>
    <title>Hello World</title>
    <script>let that, be, empty</script>
</head>
<body>
    
    <nav>
        <a href="https://hello.com">(0) hugs to you</a>
        <a href="https://world.com">(1) global issues</a>
    </nav>
    <h1>Hello World</h1>
    <p>some content</p>
</body>
</html>`)
})

test('Add caching example', async t => {
    const cache = {}
    function hasCache(key) {
        return key in cache
    }
    function getCache(key) {
        return cache[key] ?? null
    }
    function setCache(key, value) {
        cache[key] = value
    }

    const baseTemplate = {
        id: 'baseTemplate',
        cache: async (t, key, providerFunction) => {
            if (hasCache(key)) return getCache(key)

            const content = await providerFunction()

            setCache(key, content)

            return content
        },
    }

    const someTemplate = {
        id: 'someTemplate',
        parent: baseTemplate,
        someOtherComponent: async (t, key) => {
            return t.cache(key, () => {
                return 'someOtherComponent';
            })
        },
        someComponent: async (t, key) => {
            return t.cache(key, () => {
                return 'someComponent';
            })
        },
        main: async (t) => {
            return await t.someComponent('alpha')+' '
                + await t.someOtherComponent('alpha')+' '
                + await t.someOtherComponent('beta')+' '
                + await t.someComponent('beta')
        }
    }

    const result = await tRex(someTemplate)
    t.is(result, 'someComponent someComponent someOtherComponent someOtherComponent')
})

test('Add additional css example', async t => {
    const baseTemplate = {
        id: 'baseTemplate',
        title: 'Title',
        head: '',
        body: '',
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
        },
        addAdditionalCss: (t, css) => {
            const data = t.tmpData()
            if ('additionalCss' in data) data.additionalCss.push(css)
            else data.additionalCss = [css]
        },
        getAdditionalCss: (t) => {
            return t.tmpData().additionalCss?.join('') ?? ''
        },
    }

    const someTemplate = {
        id: 'someTemplate',
        parent: baseTemplate,
        body: async (t) => {
            t.addAdditionalCss(`
body {
    background-color: black;
    color: white;
}
            `)
            return `<p>Hello World</p>`
        },
    }

    const localContext = {
        id: 'localContext'
    }

    const content = await tRex(someTemplate, { id:"individualContext", tmpData: {}, parent:localContext })
    t.is(content, `<!doctype html>
<html lang="en">
<head>
    <title>Title</title>
    
    <style>
body {
    background-color: black;
    color: white;
}
            </style>
</head>
<body>
    <p>Hello World</p>
</body>
</html>`)
})

test('async and await', async t => {
    const result = tRex({
        id: 'rT',
        main: (t) => {
            return t.sub()
        },
        sub: (t) => {
            return t.sub1()
        },
        sub1: 'It is not async!' 
    })
    t.is(result, 'It is not async!')
})
