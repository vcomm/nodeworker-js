'use strict';

/*
 *
 */
const { EventEmitter } = require('events');
const chalk  = require('chalk');
const log4js = require('log4js');

log4js.configure({
    appenders: { 
        console: { type: 'console' } ,
        engine: { type: 'multiprocess', mode: 'master', appender: 'console' },
        logics: { type: 'multiprocess', mode: 'worker', appender: 'console' }
    },
    categories: { 
        default: { appenders: [ 'console' ], level: 'debug' },
        dafsm: { appenders: [ 'engine' ], level: 'error' },
        logic: { appenders: [ 'logics' ], level: 'debug' }, 
    }
});

const logger = log4js.getLogger('dafsm');

//const loggerLogic = log4js.getLogger('logic');
//console.debug = loggerLogic.info.bind(loggerLogic);

class Mutex extends EventEmitter {
    /* Constructor */
    constructor() {
        super()
        this._locked = false;
//        this._ee = new EventEmitter();
    }

    isLocked() {
        return this._locked;
    }
    acquire() {
        return new Promise(resolve => {
            // If nobody has the lock, take it and resolve immediately
            if (!this._locked) {
              // Safe because JS doesn't interrupt you on synchronous operations,
              // so no need for compare-and-swap or anything like that.
              this._locked = true;
              logger.debug(`Lock Mutex`)
              return resolve();
            }
      
            // Otherwise, wait until somebody releases the lock and try again
            const tryAcquire = () => {
              if (!this._locked) {
                this._locked = true;
//                this._ee.removeListener('release', tryAcquire);
                super.removeListener('release', tryAcquire);
                return resolve();
              }
            };
//            this._ee.on('release', tryAcquire);
              super.on('release', tryAcquire);
          });
    }
    release() {
        // Release the lock immediately
        this._locked = false;
        logger.debug(`UnLock Mutex`)
//        setImmediate(() => this._ee.emit('release'));
        setImmediate(() => super.emit('release'));
    }
}

/*
 * Class DAFSM implementation by ES6 for node.js / client browser
 */

class Dafsm {
    /* Constructor */
    constructor(path){
        this._path_ = path;
    }

    /** Implementation required */
    trigger(fname, cntx) {
        throw new Error('You have to implement the method doSomething!');
    }
    call(fname, cntx) {
        throw new Error('You have to implement the method doSomething!');
    }
    queuecall(cntx) {
        throw new Error('You have to implement the method doSomething!');
    }
    switch(cntx, sstate, name) {
        throw new Error('You have to implement the method doSomething!');
    }
    unswitch(cntx) {
        throw new Error('You have to implement the method doSomething!');
    }
    /* Private methods */
    getByKey(obj, key, value) {
        if (typeof Array.isArray === 'undefined') {
            Array.isArray = function(obj) {
                return Object.prototype.toString.call(obj) === '[object Array]';
            }
        }
        if (Array.isArray(obj)) {
            let item = null
            for (let i=0; i<obj.length; i++) {
                item = obj[i]
                if (item[key] === value)
                    break
            }
            return item
        } else {
            return obj[value]
        }
    }
    eventListener(cntx) {
        let trn = null, trans = null
        //let state = this.getByKey(cntx.logic.states, "key", cntx.keystate)
        let state = cntx.get()['keystate']
        if (state && state.hasOwnProperty("transitions")) {
            for (let i=0; i<state.transitions.length; i++) {
                trans = state.transitions[i]
                if (trans.hasOwnProperty("triggers")) {
                    for(let j=0; j<trans.triggers.length; j++) {
                        const res = this.trigger(trans.triggers[j].name, cntx)
                        if (typeof res === "boolean" && res === true) {
                            return trn = trans
                        } /*else if (res instanceof Promise) {
                            res.then((data) => {
                                if (typeof data === "boolean" && data === true) {
                                    trn = trans
                                }
                            })
                        }*/
                    }
                }
            }
        }
        return trn
    }    
    gotoNextstate(trans,fsm) {
        return this.getByKey(fsm.states, "key", trans.nextstatename)
    }
    stayAction(cntx) {
        //let state = this.getByKey(cntx.logic.states, "key", cntx.keystate)
        let state = cntx.get()['keystate']
        if (state && state.hasOwnProperty("stays")) {
            state.stays.forEach(action => {
                this.call(action.name,cntx)
            })
        }
    }
    exitAction(cntx) {
        //let state = this.getByKey(cntx.logic.states, "key", cntx.keystate)
        let state = cntx.get()['keystate']
        if (state && state.hasOwnProperty("exits")) {
            state.exits.forEach(action => {
                this.call(action.name,cntx)
            })
        }
    }
    effectAction(trans,cntx) {
        if (trans.hasOwnProperty("effects")) {
            trans.effects.forEach(action => {
                this.call(action.name,cntx)
            })
        }
    }
    entryAction(cntx) {
        //let state = this.getByKey(cntx.logic.states, "key", cntx.keystate)
        let state = cntx.get()['keystate']
        if (state && state.hasOwnProperty("entries")) {
            state.entries.forEach(action => {
                this.call(action.name,cntx)
            })
        }
    }
    fsmError(message) {
        logger.fatal(chalk`{red.bold ${message}}`)
    }
    /**
     * Public Implementation fsm single step
     */
    event(cntx) {
        try {
            const keystate = cntx.get()['keystate']
            if (!keystate)
                throw this.fsmError("FSM error: missing current state")
            let trans = this.eventListener(cntx)
            if (trans) {
                let nextstate = this.gotoNextstate(trans,cntx.get()['logic'])
                if (nextstate) {
                    this.exitAction(cntx)
                    this.effectAction(trans,cntx)
                    cntx.set('keystate',nextstate)
                    this.entryAction(cntx)
                    if(nextstate.hasOwnProperty("superstate")) {
                        this.switch(cntx, nextstate.superstate, nextstate.name)
                    }              
                    this.queuecall(cntx)  
                } /*else {
                    throw this.fsmError("FSM error: next state missing");
                }*/
            } else {
                this.stayAction(cntx)
                this.queuecall(cntx)
            }
        } catch(e) {
//            logger.error('Error: ' + e.name + ":" + e.message + "\n" + e.stack);
            throw e;
        } finally {
            //let state = cntx.logic.states[cntx.keystate]
            let state = cntx.get()['keystate']
            if (state &&
                (!state.hasOwnProperty("transitions") ||
                    state.transitions.length == 0)) {
                cntx.complete = true
                this.unswitch(cntx)
            }
            return cntx
        }
    }
}

class Content extends Mutex {
    /* Constructor */
    constructor(text){
        super()
        this._name_ = text;
        this._status_ = [];
        this._engine_ = null;
        this._arg_ = {
            "logic": null,
            "keystate": null,
            "complete": true
        }
        this._logseqfuncs_ = {};
        this.logger = log4js.getLogger('logic');
        console.debug = (msg,fname) => {
            const logic = this.get()['logic']
            const lname = logic.prj+logic.id
            this.logger.debug(chalk`{red.bold (${lname}) [${msg}]}`)
            if(fname) this.logging(fname,msg)
        }
//        console.debug = this.logger.debug.bind(this.logger);
//        logger.fatal(chalk`{red.bold ${text}}`)
    }

    loglevel(level) { return logger.level =  level }

    logging(fname,msg) {
        /*
            {
                fbodylogs: ['..','..'],
                .....................
            }
        */
       if (this._logseqfuncs_[fname])
           this._logseqfuncs_[fname].push(msg)
    }

    newlog(fname) {
        this._logseqfuncs_[fname] = []
    }

    clearlog() {
        logger.trace(`Show prn logs: `,this._logseqfuncs_)
        this._logseqfuncs_ = {}
    }

    getLog() {
        return this._logseqfuncs_
    }

    engine(engine) {
        this._engine_ = engine
        return this._engine_
    }    
    bios() {
        throw new Error('You have to implement the method doSomething!');
    }
    get() {
        return this._arg_
    }
    set(name, value) {
        this._arg_[name] = value
        return this._arg_
    }
    shift(logic, istate) {
        if (!logic || !istate) return null
        /* Update status list */
        let item = this._status_[this._status_.length-1]
        item['keystate'] = this._arg_['keystate']['key']
        item['complete'] = this._arg_['complete']
        
        this.set("logic", logic)
        this.set("complete", false)
        this.set("keystate", istate)
        this._status_.push({'logic': logic["id"], 'keystate': istate['key'], 'complete': false})
        return this
    }
    unshift(manager) {
        // remove incapsulated child logic
        this._status_.pop()
        // restore parent logic
        const item = this._status_[this._status_.length-1]
        const logic = manager._logics_[item['logic']]
        this.set("logic", logic)
        this.set("complete", item['complete'])
        let istate = manager.getByKey(logic['states'], 'key', item['keystate'])
        this.set("keystate", istate)
        return this
    }
    async emit() {
        if (this._engine_) {
            this._engine_.event(this)
        }
        return this
    }
}
 
class Wrapper extends Dafsm {
    /* Constructor */
    constructor(path){
        super(path)
        this._logics_   = {}
        this._seqfuncs_ = []
    }

    trigger(fname, cntx) {
        const bios = cntx.bios()
        if(bios.hasOwnProperty(fname)) {
            return bios[fname].func(cntx)
        } else {
            logger.error(`The function reference key: ${fname} not exist`)
            return null
        }
    }
    call(fname, cntx) {
        const bios = cntx.bios()
        this._seqfuncs_.push(bios[fname])
        logger.debug(`Accelerate functions seq: ${fname}`)
        cntx.newlog(fname)
    }
    queuecall(cntx) {
        logger.trace(`Execute New Queue ${this._seqfuncs_.length} calls`)
        this._seqfuncs_.forEach(item => {
            item.func(cntx,item.name)
        })
        this._seqfuncs_= []
    }
    switch(cntx, sstate, name) {
        let logic = null
        if (name != '*') {
            if (this._logics_.hasOwnProperty(name))
                logic = this._logics_[name]
            else
                logic = this.load(this.read(sstate["link"]))
            cntx.shift(logic, super.getByKey(logic['states'], 'key', 'init'))
        } else {
            logic = this.load(this.read(sstate["link"]))
            cntx.shift(logic, super.getByKey(logic['states'], 'key', 'init'))
        }
        return  
    }
    unswitch(cntx) {
        cntx.unshift(this)
        return  
    }
    read(link) {
        //logger.trace(`Current directory: ${__dirname}`)
        return require(`${this._path_}${link}`)
    }
    load(json) {
        let logic = null
        if (typeof json === 'string' || json instanceof String)
            logic = JSON.parse(json)
        else
            logic = json
        this._logics_[logic["id"]] = logic
        return logic
    }
    init(logic, cntx) {
        const iState = super.getByKey(logic['states'], 'key', 'init')
        if (iState) {
            cntx.set("logic", logic)
            cntx.set("complete", false)
            cntx.set("keystate", iState)
            cntx._status_.push({'logic': logic["id"], 'keystate': iState['key'], 'complete': false})
            logger.info(`Initialization completed: ${logic["prj"]}${logic["id"]}`)
            return cntx
        } else 
        logger.error("Error: cannot find init state")
        return null
    }

    validate(lname, cntx) {
        let status = true
        try {
            const logic = this._logics_[lname]
            const states = logic['states']
            const bios = cntx.bios()
            if (states instanceof Array) {
                states.forEach(state => {
                    if (state && state.hasOwnProperty("exits")) {
                        state.exits.forEach(ext => {
                            if (!bios[ext.name])
                                throw this.fsmError(`Wrong Exit function: ${ext.name}`);
                        })
                    }  
                    if (state && state.hasOwnProperty("stays")) {
                        state.stays.forEach(stay => {
                            if (!bios[stay.name])
                                throw this.fsmError(`Wrong Stay function: ${stay.name}`);
                        })
                    }
                    if (state && state.hasOwnProperty("entries")) {
                        state.entries.forEach(ent => {
                            if (!bios[ent.name])
                                throw this.fsmError(`Wrong Entry function: ${ent.name}`);
                        })
                    }  
                    if (state && state.hasOwnProperty("transitions")) {
                        state.transitions.forEach(trans => {
                            if (trans.hasOwnProperty("triggers")) {
                                trans.triggers.forEach(trig => {
                                    if (!bios[trig.name])
                                        throw this.fsmError(`Wrong Trigger function: ${trig.name}`);
                                })
                            }
                            if (trans.hasOwnProperty("effects")) {
                                trans.effects.forEach(eff => {
                                    if (!bios[eff.name])
                                        throw this.fsmError(`Wrong Effect function: ${eff.name}`);
                                })
                            }
                        })                        
                    }                                                
                })
            } else {
                logger.error('State List is not list')
                status = false
            }
        } catch(e) {
//            logger.error('Error: ' + e.name + ":" + e.message + "\n" + e.stack);
            status = false
            throw e;
        } finally {
            return status
        }
    }
}

class AsyncWrapper extends Wrapper {
    /* Constructor */
    constructor(path){
        super(path)
//        this._mutex = new Mutex();
    }

    async runcall(item, cntx) {      
        //const args = func.toString()
        //                .match(/\((?:.+(?=\s*\))|)/)[0]
        //                .slice(1).split(/\s*,\s*/g);
        //logger.debug(`Function Argumetns`,args)        
        return (item.func.constructor.name === 'AsyncFunction')
            ? await item.func(cntx,item.name)
            : item.func(cntx,item.name);
    } 
    async seqcall(funcs, cntx) {
        let data = cntx
        await funcs.reduce( 
            (p, item) => p.then(
                () => this.runcall(item, data).then(
                    result => {
                        funcs.shift()
                })
            ), Promise.resolve(cntx)
        )
    }
    async queuecall(cntx) {
        logger.trace(`Execute New Queue ${this._seqfuncs_.length} calls`)
        await this.seqcall(this._seqfuncs_,cntx)
//        Promise.resolve(await this.seqcall(this._seqfuncs_,cntx))
//            .then(() => logger.trace('Execute Queue calls'));
    }
    async event(cntx) {
//        await this._mutex.acquire()  
        await cntx.acquire()  
        return (new Promise((resolve,reject) => {
            const keystate = cntx.get()['keystate']
            if (keystate) resolve(keystate)
            else reject(this.fsmError("FSM error: missing current state"))            
        }))
        .then((curstate) => {
            return this.eventListener(cntx)
        })
        .then(trans => { 
            if (trans) {
                this.exitAction(cntx)
                this.effectAction(trans,cntx)                
                return this.gotoNextstate(trans,cntx.get()['logic'])
            } else {
                this.stayAction(cntx)
                this.queuecall(cntx)              
            }
        })
        .then(async nextstate => { 
            if (nextstate) {
                cntx.set('keystate',nextstate)
                this.entryAction(cntx)
                if(nextstate.hasOwnProperty("superstate")) {
                    this.switch(cntx, nextstate.superstate, nextstate.name)
                }              
                await this.queuecall(cntx)  
            } /*else {
                throw this.fsmError("FSM error: next state missing");
            }*/            
        })
        .catch(e => {
//            logger.error('Error: ' + e.name + ":" + e.message + "\n" + e.stack);
            throw e;
        })
        .finally(() => {
            const state = cntx.get()['keystate']
            if (state &&
                (!state.hasOwnProperty("transitions") ||
                    state.transitions.length == 0)) {
                cntx.complete = true
                this.unswitch(cntx)
            }
//            this._mutex.release()
            cntx.release()
        })
    }
}

if (typeof module !== 'undefined' &&
    typeof module.exports !== 'undefined') {
    module.exports.DAFSM = Dafsm
    module.exports.CONTENT = Content
    module.exports.WRAPPER = Wrapper
    module.exports.ASYNCWRAPPER = AsyncWrapper
}