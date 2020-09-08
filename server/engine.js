'use strict';

const dafsm = require('dafsm')
const EventEmitter = require('events')
const log4js = require('log4js');
const logger = log4js.getLogger('Engine');
logger.level = 'trace';

class adaptiveContent extends dafsm.CONTENT {

    constructor(dataflow) {
        super('nodeAdaptiveContent')
        this._abios_ = {}
        this._dflow_ = dataflow || 'cntx'
    }    

    bios() {
        return this._abios_
    }

    addAtom(fnKey, fnCode) {
        this._abios_[fnKey] = new Function(this._dflow_, fnCode)
        if (!fnCode)
            logger.warn(`Not found ${fnKey} atom's function body`)
    }

    remAtom(fnKey) {
        if (this._abios_.hasOwnProperty(fnKey))
            delete this._abios_[fnKey]
    }
}

class adaptiveEngine extends dafsm.ASYNCWRAPPER {
    constructor(path,acntn) {
        super(path || './')
        this._evemitter_ = new EventEmitter()
        this._evemitter_.on('dafsm', (mode, stream, suid) => {
            logger.trace(`Even drive on[dafsm] mode: ${mode}`) 
            if (mode === 'step') {
                if (this._cntn_.get()['complete'] != true) {
                    //this._cntn_.emit()
                    const prev = this.getCntn().get()['keystate']
                    this.event(this._cntn_)
                    .then(() => { 
                        stream({ suid: suid, execute: {currState: prev, nextState: this.getCntn().get()['keystate']} })
                    })                
                } else {
                    stream({ suid: suid, execute: {currState: `complete`, nextState: `complete`} })
                }  
            } else if (mode) { // mode shall be interval
                this.loop(mode, stream, suid)
            }       
        })        
        this._cntn_ = acntn || new adaptiveContent()
        this._cntn_.engine(this)
//        this.init(this.load(this.read('main.json')), this._cntn_)
    }     

    getCntn() { return this._cntn_ }

    getLogics(logicname) {
        if (logicname && this._logics_.hasOwnProperty(logicname)) {
            return this._logics_[logicname]
        } else {
            let llist = []
            for (var key of Object.keys(this._logics_)) {                
                llist.push(key)
            }
            return llist
        }    
    }

    activeLogic(logicname) {
        if (logicname && this._logics_.hasOwnProperty(logicname)) {
            this.init(this._logics_[logicname], this._cntn_)
            return { activated: `${logicname} complete` }
        } else
            return { activated: `${logicname} failed: logic not exist` }
    }

    delLogic(logicname) {
        if (logicname && this._logics_.hasOwnProperty(logicname)) {
            delete this._logics_[logicname]
            return { deleted: `${logicname} complete` }
        } else
            return { deleted: `${logicname} failed: logic not exist` }
    }

    removeEvent(evname) {
        if (evname !== 'dafsm') {
            this._evemitter_.removeAllListeners(evname)
            return { removed: `${evname} complete` }
        } else 
            return { removed: `${evname} forbidden` }
    }

    read(link) {
        logger.debug(`Current directory: ${__dirname}, read: ${this._path_}${link}`)
        return require(`${this._path_}${link}`)
    }     

    emitOn(evname,cblkfn) {
        if (evname) {
            let func = new Function('evname', cblkfn || 'console.log("Even drive on",evname)')
            this._evemitter_.on(evname, (mode, stream, suid) => { 
                if (mode === 'step') {
                    stream({ suid: suid, execute: `drive on[${evname}] | ${func(evname)}` })
                } else if (mode) {
                    // shall setInterval with xMs and numOfCounts
                }
            })
        } 
        return this._evemitter_.eventNames()
    }

    emitEvent(evname, mode, stream, suid) {
        return this._evemitter_.emit(evname, mode, stream, suid);
    }

    load(json) {
        let logic = null
        let status = { error: 'Not error found'}
        try {
            if (typeof json === 'string' || json instanceof String)
                logic = JSON.parse(json)
            else
                logic = json
            this._logics_[logic["id"]] = logic

            if (!this._cntn_.bios()[logic['start'].name]) {
                this._cntn_.addAtom(logic['start'].name, logic['start'].func)
            }
            if (!this._cntn_.bios()[logic['stop'].name]) {
                this._cntn_.addAtom(logic['stop'].name, logic['stop'].func)
            }
            const states = logic['states']
            if (states instanceof Array) {
                this.validArrayStates(states)
            } else if (states instanceof Object) {
                this.validObjectStates(states)
            } else {      
                logger.error('Not compatible States')
                status.error = 'Not compatible States'
            }
        } catch(e) {
            logger.fatal('Error: ' + e.name + ":" + e.message + "\n" + e.stack);
            status.error = e
        } finally {
            return logic
        }        
    }

    validArrayStates(states) {
        const bios = this._cntn_.bios()
        states.forEach(state => {
            if (state && state.hasOwnProperty("exits")) {
                state.exits.forEach(ext => {
                    if (!bios[ext.name])
                        this._cntn_.addAtom(ext.name, ext.func)
                })
            }  
            if (state && state.hasOwnProperty("stays")) {
                state.stays.forEach(stay => {
                    if (!bios[stay.name])
                        this._cntn_.addAtom(stay.name, stay.func)
                })
            }
            if (state && state.hasOwnProperty("entries")) {
                state.entries.forEach(ent => {
                    if (!bios[ent.name])
                        this._cntn_.addAtom(ent.name, ent.func)
                })
            }
            this.validTransition(state)
        })            
    }

    validObjectStates(states) {
        for (let [key, state] of Object.entries(states)) {
            if (state && state.hasOwnProperty("exits")) {
                state.exits.forEach(ext => {
                    if (!bios[ext.name])
                        this._cntn_.addAtom(ext.name, ext.func)
                })
            }  
            if (state && state.hasOwnProperty("stays")) {
                state.stays.forEach(stay => {
                    if (!bios[stay.name])
                        this._cntn_.addAtom(stay.name, stay.func)
                })
            }
            if (state && state.hasOwnProperty("entries")) {
                state.entries.forEach(ent => {
                    if (!bios[ent.name])
                        this._cntn_.addAtom(ent.name, ent.func)
                })
            }
            this.validTransition(state)
        }        
    }

    validTransition(state) {
        const bios = this._cntn_.bios()
        if (state && state.hasOwnProperty("transitions")) {
            state.transitions.forEach(trans => {
                if (trans.hasOwnProperty("triggers")) {
                    trans.triggers.forEach(trig => {
                        if (!bios[trig.name]) {
                            this._cntn_.addAtom(trig.name, trig.func)
                        }
                    })
                }
                if (trans.hasOwnProperty("effects")) {
                    trans.effects.forEach(eff => {
                        if (!bios[eff.name]) {
                            this._cntn_.addAtom(eff.name, eff.func)
                        }
                    })
                }
            })                        
        }        
    }

    async loop(ms, stream) {
        while(this.getCntn().get()['complete'] != true) {
            const prev = this.getCntn().get()['keystate']
            await this.event(this._cntn_)
            .then(() => { 
                stream({ suid: suid, execute: {currState: prev, nextState: this.getCntn().get()['keystate']} })
            })
            await new Promise(resolve => setTimeout(resolve, ms));
        }
    }

    startLogic(logicname) {        
        return this.init(this._logics_[logicname], this._cntn_)
    }
}

if (typeof module !== 'undefined' &&
    typeof module.exports !== 'undefined') {
    module.exports.aContent = adaptiveContent
    module.exports.aEngine  = adaptiveEngine
}