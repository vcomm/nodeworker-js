'use strict';

const dafsm = require('dafsm')
const EventEmitter = require('events')

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
            console.warn(`Not found ${fnKey} body`)
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
        this._evemitter_.on('dafsm', (res) => {
            console.log("Even drive on[fsm] :") 
            if (this._cntn_.get()['complete'] != true) {
                //this._cntn_.emit()
                this.event(this._cntn_)
                .then(() => { 
                    res.json({ service:`Even drive on[dafsm]`, responce: this.getCntn().get()['keystate'] })
                })                
            } else {
                res.json({ service:`Even drive on[dafsm]`, responce: `complete` })
            }          
        })        
        this._cntn_ = acntn || new adaptiveContent()
        this._cntn_.engine(this)
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

    delLogic(logicname) {
        if (logicname && this._logics_.hasOwnProperty(logicname)) {
            delete this._logics_[logicname]
            return { deleted: `${logicname} complete` }
        } else
            return { deleted: `${logicname} failed` }
    }

    removeEvent(evname) {
        if (evname !== 'dafsm') {
            this._evemitter_.removeAllListeners(evname)
            return { removed: `${evname} complete` }
        } else 
            return { removed: `${evname} forbidden` }
    }

    read(link) {
        console.debug(`Current directory: ${__dirname}, read: ${this._path_}${link}`)
        return require(`${this._path_}${link}`)
    }     

    emitOn(evname,cblkfn) {
        if (evname) {
            let func = new Function('evname', cblkfn || 'console.log("Even drive on",evname)')
            this._evemitter_.on(evname, (res) => { 
                res.json({ service:`Even drive on[${evname}]`, responce: func(evname)})
            })
        } 
        return this._evemitter_.eventNames()
    }

    emitEvent(evname,res) {
        return this._evemitter_.emit(evname,res);
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
                console.error('Not compatible States')
                status.error = 'Not compatible States'
            }
        } catch(e) {
            console.error('Error: ' + e.name + ":" + e.message + "\n" + e.stack);
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

    startLogic(logicname) {        
        return this.init(this._logics_[logicname], this._cntn_)
    }
}

if (typeof module !== 'undefined' &&
    typeof module.exports !== 'undefined') {
    module.exports.aContent = adaptiveContent
    module.exports.aEngine  = adaptiveEngine
}