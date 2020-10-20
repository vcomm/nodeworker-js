'use strict';

const { Message } = require('./message');
const { aEngine, aLogger } = require('./engine')
const log4js = require('log4js');
let logger = log4js.getLogger(`worker-${process.pid}`);
logger.level = 'trace';

class aWorker extends Message {

    constructor(events) {
        super(`worker-${process.pid}`,events);
        this.metrics = []
        this.evDict  = { dafsm: false }
        this.engine = new aEngine('../')    
        this.engine._process_ = this   
        if (process.env['script']) {
            const verify = this.engine.load(this.engine.read(process.env['script']))
            if (verify.fault > 0) {
                logger.warn(`Verification Atom's Fault! ${verify.fault}, in Worker process ${process.pid}`)
            } else {
                this.engine.activeLogic(verify.lid)
                logger.debug(`Worker process ${process.pid} start with env: ${process.env['script']}`)
                setTimeout(() => { this.engine.emitEvent('dafsm','step',this.msgStream) }, 1000)
            }
        }
    } 

    init() {        
        const self = this;
        const cntx = this.engine.getCntn();
        process
            .on('message', function(msg) {
                if (msg.chat) {
                    logger.trace(`Master to worker: ${process.pid} | `, msg.chat);  
                    if (msg.chat === 'Updatepath') {   
                        self.wid = msg.wid
                        self.engine._path_ = msg.path + self.engine._path_  
                        logger.trace(`Worker[${msg.wid}]: ${process.pid}, update engine path | `, self.engine._path_);   
                    } 
                    if (msg.chat.offset) {   
                        cntx.etlProcess(msg.chat,self)                        
                    }  
                }
                if (msg.head) self.evMessage(msg);                  
            });

        this.collectMetrics();    
        logger.debug(`Worker process ${process.pid} complete initialize!`)    
    }

    msgSend(message) {
        message.process = process.pid
        process.send({ chat: message });
    }

    evMessage(message) {
        return super.response(message);
    }  

    getChild() {
        return this;
    }

    msgStream(message) {
        message.process = process.pid
        process.send({ stream: message });
    }

    collectMetrics() {
        let count = 0;
        const interval = 60000; // 60 sec
        const retential_threshold = 60; // 10 min
        let usageMem = {},
            usageCpu = process.cpuUsage();
        setInterval(()=>{
            usageMem = process.memoryUsage()
            usageCpu = process.cpuUsage(usageCpu)
            this.msgStream({metrics: {cpu: usageCpu, mem: usageMem, time: Date.now()}})
            this.metrics.push({cpu: usageCpu, mem: usageMem}) 
            count++
            if (count > retential_threshold) {
                this.metrics = []
                count = 0
                logger.debug(`Clear process: ${process.pid} metrics`)
            }
        },interval)
    }

    eventStatus(evname) {
        if (this.evDict.hasOwnProperty(evname))
            return this.evDict[evname]
        else 
            return false
    }
}

module.exports = {
    aWorker: aWorker,
    Logger : logger
}

new aWorker({
    loglevel: (msg, self) => { 
        let logLevel = logger.level
        logger.trace(`Worker: ${process.pid} | set loglevel:`,msg.body); 
        if (msg.body.module === 'worker') {
            logLevel = logger.level = msg.body.level
        } else if (msg.body.module === 'engine') {
            logLevel = aLogger.level = msg.body.level
        } else if (msg.body.module === 'dafsm') {
            logLevel = self.engine.getCntn().loglevel(msg.body.level)
        }
        return new Promise((resolve) => resolve({ 
            module: msg.body.module, level: logLevel 
        })) 
    },
    evlist: (msg,  self) => {
        logger.trace(`Worker: ${process.pid} | get events collection:`); 
        return new Promise((resolve) => resolve(self.engine.emitOn())) 
    },
    logics: (msg,  self) => {
        logger.trace(`Worker: ${process.pid} | get logic collection:`); 
        return new Promise((resolve) => resolve(self.engine.getLogics())) 
    },
    getlogic: (msg,  self) => {
        logger.trace(`Worker: ${process.pid} | getlogic:`, msg.body);    
        return new Promise((resolve) => resolve(self.engine.getLogics(msg.body))) 
    },
    attach: (msg,  self) => {
        logger.trace(`Worker: ${process.pid} | logic attach:`, msg.body);    
        return new Promise((resolve) => resolve(self.engine.load(msg.body))) 
    },
    activate: (msg,  self) => {
        logger.trace(`Worker: ${process.pid} | activate logic:`, msg.body);    
        return new Promise((resolve) => resolve(self.engine.activeLogic(msg.body))) 
    },
    dellogic: (msg,  self) => {
        logger.trace(`Worker: ${process.pid} | delete logic:`, msg.body);    
        return new Promise((resolve) => resolve(self.engine.delLogic(msg.body))) 
    },
    execute: (msg,  self) => {
        let status = false
        logger.trace(`Worker: ${process.pid} | execute logic: ${msg.body.event} in mode:`, msg.body.mode);  
        if (msg.body.mode === 'step') {  
            status = self.engine.emitEvent(msg.body.event,msg.body.mode,self.msgStream,msg.body.suid)          
            return new Promise((resolve) => resolve({ execute: { 
                evname: msg.body.event, 
                mode  : `${msg.body.mode}`,
                state : status 
            }})) 
        } else if(self.evDict.hasOwnProperty(msg.body.event) && 
                  self.evDict[msg.body.event] === false) {
            self.evDict[msg.body.event] = msg.body.mode
            status = self.engine.emitEvent(msg.body.event,msg.body.mode,self.msgStream,msg.body.suid)
            return new Promise((resolve) => resolve({ execute: { 
                evname: msg.body.event, 
                mode  : `loop[${msg.body.mode}]`,
                state : `play` 
            }})) 
        } else if(self.evDict.hasOwnProperty(msg.body.event)) {
            self.evDict[msg.body.event] = false
            return new Promise((resolve) => resolve({ execute: { 
                evname: msg.body.event, 
                mode  : msg.body.mode,
                state : `pause` 
            }})) 
        } else {
            return new Promise((resolve) => resolve({ execute: { 
                evname: msg.body.event, 
                mode  : msg.body.mode,
                state : `fault` 
            }}))            
        }
    },
    newevent: (msg,  self) => {
        self.evDict[msg.body.event] === false
        logger.trace(`Worker: ${process.pid} | create event: ${msg.body.evname} func:`, msg.body.func);    
        return new Promise((resolve) => resolve(self.engine.emitOn(msg.body.evname,msg.body.func))) 
    },
    delevent: (msg,  self) => {
        logger.trace(`Worker: ${process.pid} | delete event: ${msg.body.evname}`);    
        return new Promise((resolve) => resolve(self.engine.removeEvent(msg.body.evname))) 
    },
    metrics: (msg,  self) => {
        logger.trace(`Worker: ${process.pid} | retrive metrics:`);    
        return new Promise((resolve) => resolve(self.metrics)) 
    },
    resources: (msg,  self) => {
        logger.trace(`Worker: ${process.pid} | retrive all resources:`);    
        return new Promise((resolve) => resolve({events: self.engine.emitOn(), logics: self.engine.getLogics(), metrics: self.metrics})) 
    }
}).init()


