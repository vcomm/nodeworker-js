'use strict';

//const dafsm = require('dafsm')
const { CONTENT, ASYNCWRAPPER } = require('./dafsm')
const EventEmitter = require('events')
const log4js = require('log4js');
const logger = log4js.getLogger('engine');
logger.level = 'trace';

class adaptiveContent extends CONTENT {

    constructor(dataflow) {
        super('nodeAdaptiveContent')
        this._abios_ = {}
        this._api_   = {}
        this._dflow_ = dataflow || 'cntx'
    }    

    bios() {
        return this._abios_
    }

    api() {
        return this._api_
    }

    addAtom(fnKey, fnCode) {
//        this._abios_[fnKey] = new Function(this._dflow_, 'fname', fnCode)
        let bverify = false
        if (!fnCode) {
            if (!this._abios_[fnKey]) {
                logger.warn(`Not found ${fnKey} atom's function body`)
            } else {
                bverify = true
                logger.info(`${fnKey} atom's function body found in previous script`)
            }
        } else {
            logger.info(`Worker process ${process.pid} try assign to ${fnKey} new function body`)
            this._abios_[fnKey] = {
                name: fnKey,
                func: new Function(this._dflow_, 'fname', fnCode)
            }
            logger.info(`Worker process ${process.pid} atom's ${fnKey} assigned new function body`)
            bverify = true
        }
        return {fname: fnKey, verify: bverify}
    }

    remAtom(fnKey) {
        if (this._abios_.hasOwnProperty(fnKey))
            delete this._abios_[fnKey]
    }

    apiContent() {
        this._api_.publish = (topic,msg) => {
            this._engine_._process_.msgSend({
                service: 'publish',
                topic  : topic,
                notice : msg
            })
        }
        this._api_.subscribe = (topics,threshold) => {
            this._threshold_ = threshold ? threshold : 1
            this._engine_._process_.msgSend({
                service: 'subscribe',
                topics : topics
            })
        }
        this._api_.data = () => {
            if (!this._data_) {
                return this._data_ 
            } else {
                const data = (this._data_ instanceof Array && this._data_.length > 0) ? this._data_[this._data_.length-1] : this._data_   
                logger.trace(`API data() worker-${process.pid}:`, data)
                return data     
            }    
        }
    }

    etlProcess(msg,self) {
/*        
        if (!this._data_ || this._threshold_ === 1) { 
            this._data_ = msg
            return {mode: 'exec', offset: this._data_.offset}
        } else {
            const from = (this._data_ instanceof Array && this._data_.length > 0) ? 
                          this._data_[this._data_.length-1].offset : this._data_.offset
            logger.debug(`ETL Offsets: ${from} / ${msg.offset}`, JSON.stringify(this._data_))
            if ((msg.offset - from) >= this._threshold_) {
                return {mode: 'retrieve', topic: msg.topic, from: from, range: msg.offset}
            } else {
                return {mode: 'skip', offset: msg.offset}
            }
        }
*/   
        if (this._threshold_ === 1) { 
            this.dataUpdate(msg)
            logger.trace(`ETL worker-${process.pid}, exec mode`, this._data_);
//            this.emit()
            self.engine.emitEvent('dafsm','step',self.msgStream) 
        } else {
            const from = (this._data_ instanceof Array && this._data_.length > 0) ? 
                          this._data_[this._data_.length-1].offset : 
                          (this._data_) ? this._data_.offset : this.dataUpdate(msg).offset
            logger.debug(`ETL Offsets: ${from} / ${msg.offset}`, JSON.stringify(this._data_))
            if ((msg.offset - from) >= this._threshold_) {
                self.request({ 
                    head: {
                        target  : 'master',
                        origin  : self.wid,
                        request : 'retrieve'
                    },
                    body: {topic: msg.topic, from: from, range: msg.offset}
                })
                .then(newdata => { 
                    logger.debug(`ETL worker-${process.pid}: Retrieved data block ->`,JSON.stringify(this.dataUpdate(newdata.data.body))) 
                    self.engine.emitEvent('dafsm','step',self.msgStream)  
                })            
            }
        }             
    }

    dataUpdate(data) {
        return this._data_ = data
    }
}

class adaptiveEngine extends ASYNCWRAPPER {
    constructor(path,acntn) {
        super(path || './')
        this._process_ = null
        this._evemitter_ = new EventEmitter()
        this._evemitter_.on('dafsm', (mode, stream, suid) => {
            logger.trace(`Even drive on[dafsm] mode: ${mode}`) 
            if (mode === 'step') {
                if (this._cntn_.get()['complete'] != true) {
                    //this._cntn_.emit()
                    const cntn = this.getCntn()
                    const prev = cntn.get()['keystate']
                    this.event(this._cntn_)
                    .then(() => { 
                        stream({ suid: suid, execute: {currState: prev.key, nextState: cntn.get()['keystate'].key, prnlog: cntn.getLog()} })
                    })  
                    .then(() => {
                        cntn.clearlog()
                    })              
                } else {
                    const stop = this._cntn_.get()['logic'].stop
                    if (stop && stop.name && this._cntn_.bios()[stop.name]) {
                        this._cntn_.bios()[stop.name].func ? 
                        this._cntn_.bios()[stop.name].func(this._cntn_) :
                        logger.error(`Stop ${stop.name} atom's function body not assigned yet`)
                    }
                    stream({ suid: suid, execute: {currState: `complete`, nextState: `complete`} })
                }  
            } else if (mode) { // mode shall be interval
                this.loop(mode, stream, suid)
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

    activeStart() {
        const cntn = this.getCntn()
        const start = cntn.get()['logic'].start
        if (start && start.name && cntn.bios()[start.name]) {
            logger.debug(`Active logic in process: ${process.pid} starting... `)    
            cntn.bios()[start.name].func ? 
            cntn.bios()[start.name].func(cntn) :
            logger.error(`Start ${start.name} atom's function body not assigned yet`)
        } else {
            logger.error(`Start ${start.name} atom's function assigned missed`)
        }        
    }

    activeStop() {
        const cntn = this.getCntn()
        const stop = cntn.get()['logic'].stop
        if (stop && stop.name && cntn.bios()[stop.name]) {
            logger.debug(`Active logic in process: ${process.pid} stopping... `) 
            cntn.bios()[stop.name].func ? 
            cntn.bios()[stop.name].func(cntn) :
            logger.error(`Stop ${stop.name} atom's function body not assigned yet`)
        } else {
            logger.error(`Stop ${stop.name} atom's function assigned missed`)
        }           
    }

    activeLogic(logicname) {
        const cntn = this.getCntn()
        if (logicname && this._logics_.hasOwnProperty(logicname)) {
            this.init(this._logics_[logicname], cntn).apiContent()
            this.activeStart()
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
                } else if (mode && this._process_ && this._process_.eventStatus(evname)) {
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
        let verifyproc = { fault: 0 }
        let logic = null
        let status = { error: 'Not error found'}
        try {
            if (typeof json === 'string' || json instanceof String)
                logic = JSON.parse(json)
            else
                logic = json

            verifyproc['lid'] = logic["id"]    
            logger.debug(`Loading logic: ${logic["prj"]}${logic["id"]}, process: ${process.pid}`)    

            if (!this._cntn_.bios()[logic['start'].name]) {
                verifyproc['start'] = this._cntn_.addAtom(logic['start'].name, logic['start'].func)
                if (!verifyproc['start'].verify) verifyproc.fault++
            }
            if (!this._cntn_.bios()[logic['stop'].name]) {
                verifyproc['stop'] = this._cntn_.addAtom(logic['stop'].name, logic['stop'].func)
                if (!verifyproc['stop'].verify) verifyproc.fault++
            }
            const states = logic['states']
            if (states instanceof Array) {
                verifyproc['states'] = this.validArrayStates(states)
                verifyproc.fault += verifyproc['states'].fault
            } else if (states instanceof Object) {
                verifyproc['states'] = this.validObjectStates(states)
                verifyproc.fault += verifyproc['states'].fault
            } else {      
                logger.error('Not compatible States')
                status.error = 'Not compatible States'
            }
        } catch(e) {
            logger.fatal(`Worker process ${process.pid} ERROR: in ${logic["id"]} >` + e.name + ":" + e.message + "\n" + e.stack);
            status.error = e
        } finally {
            if (verifyproc.fault === 0) 
                this._logics_[logic["id"]] = logic
            return verifyproc
        }        
    }

    validArrayStates(states) {
        let length = 0
        let verifystates = { fault: 0 }
        const bios = this._cntn_.bios()
        states.forEach(state => {
            verifystates[state.key] = {}
            if (state && state.hasOwnProperty("exits")) {
                verifystates[state.key]['exits'] = []
                state.exits.forEach(ext => {
                    if (!bios[ext.name]) {
                        length = verifystates[state.key]['exits'].push(this._cntn_.addAtom(ext.name, ext.func))
                        if (!verifystates[state.key]['exits'][length-1].verify) verifystates.fault++
                    }
                })
            }  
            if (state && state.hasOwnProperty("stays")) {
                verifystates[state.key]['stays'] = []
                state.stays.forEach(stay => {
                    if (!bios[stay.name]) {
                        length = verifystates[state.key]['stays'].push(this._cntn_.addAtom(stay.name, stay.func))
                        if (!verifystates[state.key]['stays'][length-1].verify) verifystates.fault++
                    }
                })
            }
            if (state && state.hasOwnProperty("entries")) {
                verifystates[state.key]['entries'] = []
                state.entries.forEach(ent => {
                    if (!bios[ent.name]) {
                        length = verifystates[state.key]['entries'].push(this._cntn_.addAtom(ent.name, ent.func))
                        if (!verifystates[state.key]['entries'][length-1].verify) verifystates.fault++
                    }
                })
            }
            verifystates[state.key]['transitions'] = this.validTransition(state)
            verifystates.fault += verifystates[state.key]['transitions'].fault
        })  
        return verifystates          
    }

    validObjectStates(states) {
        let length = 0
        let verifystates = { fault: 0 }
        const bios = this._cntn_.bios()
        for (let [key, state] of Object.entries(states)) {
            verifystates[key] = {}
            if (state && state.hasOwnProperty("exits")) {
                verifystates[key]['exits'] = []
                state.exits.forEach(ext => {
                    if (!bios[ext.name]) {
                        length = verifystates[key]['exits'].push(this._cntn_.addAtom(ext.name, ext.func))
                        if (!verifystates[key]['exits'][length-1].verify) verifystates.fault++
                    }
                })
            }  
            if (state && state.hasOwnProperty("stays")) {
                verifystates[key]['stays'] = []
                state.stays.forEach(stay => {
                    if (!bios[stay.name]) {
                        length = verifystates[key]['stays'].push(this._cntn_.addAtom(stay.name, stay.func))
                        if (!verifystates[key]['stays'][length-1].verify) verifystates.fault++
                    }
                })
            }
            if (state && state.hasOwnProperty("entries")) {
                verifystates[key]['entries'] = []
                state.entries.forEach(ent => {
                    if (!bios[ent.name]) {
                        length = verifystates[key]['entries'].push(this._cntn_.addAtom(ent.name, ent.func))
                        if (!verifystates[key]['entries'][length-1].verify) verifystates.fault++
                    }
                })
            }
            verifystates[key]['transitions'] = this.validTransition(state)
            verifystates.fault += verifystates[key]['transitions'].fault
        }
        return verifystates         
    }

    validTransition(state) {
        let length = 0
        let verifytrans = { fault: 0 }
        const bios = this._cntn_.bios()
        if (state && state.hasOwnProperty("transitions")) {
            state.transitions.forEach(trans => {
                verifytrans[trans.nextstatename] = {}
                if (trans.hasOwnProperty("triggers")) {
                    verifytrans[trans.nextstatename]['triggers'] = []
                    trans.triggers.forEach(trig => {
                        if (!bios[trig.name]) {
                            length = verifytrans[trans.nextstatename]['triggers'].push(this._cntn_.addAtom(trig.name, trig.func))
                            if (!verifytrans[trans.nextstatename]['triggers'][length-1].verify) verifytrans.fault++
                        }
                    })
                }
                if (trans.hasOwnProperty("effects")) {
                    verifytrans[trans.nextstatename]['effects'] = []
                    trans.effects.forEach(eff => {
                        if (!bios[eff.name]) {
                            length = verifytrans[trans.nextstatename]['effects'].push(this._cntn_.addAtom(eff.name, eff.func))
                            if (!verifytrans[trans.nextstatename]['effects'][length-1].verify) verifytrans.fault++
                        }
                    })
                }
            })                        
        }
        return verifytrans        
    }

    async loop(ms, stream, suid) {
        while(this.getCntn().get()['complete'] != true && this._process_ && this._process_.eventStatus('dafsm')) {
            const prev = this.getCntn().get()['keystate']
            await this.event(this._cntn_)
            .then(() => { 
                stream({ suid: suid, execute: {currState: prev.key, nextState: this.getCntn().get()['keystate'].key, prnlog: this.getCntn().getLog()} })
            })
            await new Promise(resolve => setTimeout(resolve, ms));
        }
        const stop = this.getCntn().get()['logic'].stop
        if (stop && stop.name && this._cntn_.bios()[stop.name]) {
            this._cntn_.bios()[stop.name].func ? 
            this._cntn_.bios()[stop.name].func(this._cntn_) :
            logger.error(`Stop ${stop.name} atom's function body not assigned yet`)
        }
    }

    restartLogic(logicname) {        
        return this.init(this._logics_[logicname], this._cntn_)
    }
}

if (typeof module !== 'undefined' &&
    typeof module.exports !== 'undefined') {
    module.exports.aContent = adaptiveContent
    module.exports.aEngine  = adaptiveEngine
    module.exports.aLogger  = logger
}