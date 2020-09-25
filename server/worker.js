'use strict';

const Message = require('./message');
const adaptive = require('./engine')
const log4js = require('log4js');
let logger 

class aWorker extends Message {

    constructor(events) {
        super(`worker-${process.pid}`,events);
        this.metrics = []
        this.evDict  = { dafsm: false }
        this.engine = new adaptive.aEngine('../')       
        logger = log4js.getLogger(`worker-${process.pid}`);
        logger.level = 'trace';
        if (process.env['script']) {
            this.engine.init(this.engine.load(this.engine.read(process.env['script'])), this.engine._cntn_)
            logger.trace(`Worker process ${process.pid} with env: ${process.env['script']}`);
        }
        this.engine._process_ = this
    } 

    init() {        
        const self = this;
        process
            .on('message', function(msg) {
                if (msg.chat) {
                    logger.trace(`Master to worker: ${process.pid} | `, msg.chat);  
                    if (msg.chat === 'Updatepath') {   
                        self.engine._path_ = msg.path + self.engine._path_  
                        logger.trace(`Worker: ${process.pid}, update engine path | `, self.engine._path_);   
                    }   
                }
                if (msg.head) self.evMessage(msg);                  
            });
        this.collectMetrics();    
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

module.exports = aWorker

new aWorker({/*
    version: (msg) => { 
        return new Promise((resolve) => resolve({ version: `versions 1.0`})) 
    },*/
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


