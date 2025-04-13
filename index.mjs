/**
 * t-rex
 * Template Resolver Engine Xtreme
 *
 * @package t-rex4js
 * @link https://github.com/Koudela/t-rex/
 * @copyright Copyright (c) 2025 Thomas Koudela
 * @license http://opensource.org/licenses/MIT MIT License
 */

export { tRex, FinalException, ValidationException }

class FinalException extends Error {
    constructor(msg, previous) {
        super(msg);
        this.previous = previous
    }
}

class ValidationException extends Error {}

class ChainProvider {
    constructor(templateChain, contextChain=null) {
        const TYPE_CONTEXT = 0;
        const TYPE_TEMPLATE = 1;
        this.object = null;
        this.idMap = {};
        const chain = []
        buildChain(null, contextChain, TYPE_CONTEXT)
        buildChain(null, templateChain, TYPE_TEMPLATE)

        let provider
        while (provider = chain.pop()) this.addProvider(provider)

        function buildChain(lastProvider, provider, type) {
            if (provider === null) return;

            validate(lastProvider, provider, type);
            chain.push(provider);

            buildChain(provider, provider.parent ?? null, type);
        }

        function validate(lastProvider, provider, type) {
            if (!provider?.id || typeof provider.id !== 'string') {
                const description = lastProvider === null ? 'Root' : `Parent of '${lastProvider.id}'`
                type = type === TYPE_TEMPLATE ? 'template' : 'context'

                throw new ValidationException(`"${description} ${type} lacks a valid id."`)
            }
        }
    }

    addProvider(provider) {
        if (provider.id in this.idMap) {
            throw new ValidationException(`"Duplicate provider id '${provider.id}' found."`)
        }

        this.object = this.idMap[provider.id] = Object.create(this.object)

        Object.keys(provider).forEach(key => {
            // we use a reference instead of the id to have a smaller memory footprint
            this.object[key] = [this.object, provider[key]]
        })

        delete this.object.parent
    }

    get(prop, id=null) {
        const [obj, value] = (id === null ? this.object[prop] : this.idMap[id][prop]) ?? [undefined, undefined];

        return [obj?.id[1], value];
    }

    nextId(id) {
        return Object.getPrototypeOf(this.idMap[id])?.id[1];
    }
}

/**
 * @param {object} templateChain
 * @param {object|null} contextChain
 * @param {string} entrypoint
 * @param {boolean} debugMarks
 * @return {Promise<*>|*}
 */
function tRex(templateChain, contextChain=null, entrypoint='main', debugMarks=false) {
    const chainProvider = new ChainProvider(templateChain, contextChain)
    const debug = {
        templateChain,
        contextChain,
        entrypoint,
        debugMarks,
    }

    /**
     * @param {array} callStack
     * @param {string} location
     * @param {...*} params
     * @return {Promise<*|>|*}
     */
    function render(callStack, location, ...params) {
        function printStack() {
            return callStack.map(arr => arr[0]+'@'+arr[1]).join(', ')
        }

        function throwFinal(msg, previous=null) {
            throw new FinalException(`${msg} tRex stack: [${printStack()}]`, previous)
        }

        let startProviderId = null

        switch (location) {
            case 'debug':
                return new Proxy(debug, {
                    get(instance, prop) {
                        if (prop === 'printStack') return printStack
                        return instance[prop]
                    },
                    set(instance, prop, newValue) {
                        if (prop === 'debugMarks') {
                            debug.debugMarks = newValue
                            return true
                        }
                        throwFinal(`"'${prop}' is not a writable property."`)
                    },
                })
            case 'iterate':
                const iterateLocation = params.shift()
                const iterable = params.shift()
                if (!iterable?.[Symbol.iterator]) throwFinal(`"Passed value is not iterable."`)
                const arr = Array.isArray(iterable) ? iterable : [...iterable]
                return arr.map(
                    (value, index) => render(Array.from(callStack), iterateLocation, value, index, arr, ...params)
                )
            case 'parent':
                location = callStack[0][0]
                startProviderId = chainProvider.nextId(callStack[0][1]);
                const targetId = params.shift()
                if (typeof targetId === 'string') {
                    while (startProviderId !== targetId && startProviderId !== undefined) {
                        startProviderId = chainProvider.nextId(startProviderId)
                    }
                }

                break;
        }
        
        if (startProviderId === undefined) return handlePromiseOnError(handleNotFound, handleError)
        return handlePromiseOnError(() => getRessource(startProviderId), handleError)        

        function handleError(e) {
            if (location === '500' || e instanceof FinalException) throw e
            return render(Array.from(callStack), '500', location, e, ...params)    
        }

        /**
         * @return {Promise<*>|*}
         */
        function handleNotFound() {
            if (location === '500' && params[1] instanceof Error) throwFinal('', params[1])
            if (location === '404') throwFinal(`"Resource '${params[0]}' not found."`)

            return render(Array.from(callStack), '404', location, ...params)
        }

        /**
         * @return {Promise<*>|*}
         */
        function getRessource(startProviderId) {
            const [objId, resolved] = chainProvider.get(location, startProviderId)

            if (typeof resolved === 'undefined') return handleNotFound()

            function addDebugMarks(value) {
                if (!debug.debugMarks || typeof value !== 'string') return value

                const id = `${location}@${objId}`

                return `<!--${id}-->${value}<!--\\${id}>-->`;
            }

            if (typeof resolved === 'function') {
                const t = new Proxy({}, {
                    get(instance, prop) {
                        return (...params) => render(Array.from(callStack), prop, ...params)
                    },
                })
            
                callStack.unshift([location, objId])

                return handlePromiseOnSuccess(resolved(t, ...params), result => {
                    callStack.shift()
                    return addDebugMarks(result)
                })
            }

            return addDebugMarks(resolved)
        }
    }

    return handlePromiseOnError(() => render([], entrypoint), beautifyError)

    function beautifyError(e) {
        if (e instanceof FinalException && e.previous !== null) {
            e.previous.message = e.previous.message+' -->'+e.message
            throw e.previous
        }
        throw e
    }

}

function handlePromiseOnError(callable, onError) {
    try {
        const result = callable()
        return result instanceof Promise 
            ? result.catch(onError)
            : result
    } catch(e) {
        return onError(e)
    }
}

function handlePromiseOnSuccess(result, onSuccess) {
    return result instanceof Promise
        ? result.then(onSuccess)
        : onSuccess(result)
}
