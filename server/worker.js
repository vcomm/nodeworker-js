'use strict';

const Message = require('./message');
const adaptive = require('./engine')
const log4js = require('log4js');
let logger 

class aWorker extends Message {

    constructor(events) {
        super(`worker-${process.pid}`,events);
        this.metrics = []
//        this.engine = new adaptive.aEngine('.././logic/')
        this.engine = new adaptive.aEngine('../../logic/')
        logger = log4js.getLogger(`worker-${process.pid}`);
        logger.level = 'trace';
        if (process.env['script']) {
            this.engine.init(this.engine.load(this.engine.read(process.env['script'])), this.engine._cntn_)
            logger.trace(`Worker process ${process.pid} with env: ${process.env['script']}`);
        }
    } 

    init() {
        const self = this;
        process
            .on('message', function(msg) {
                if (msg.chat) {
                    logger.trace(`Master to worker: ${process.pid} | `, msg.chat);            
                }
                if (msg.head) self.evMessage(msg);                  
            });
        this.collectMetrics();    
    }

    msgSend(message) {
        process.send({ chat: message });
    }

    evMessage(message) {
        return super.response(message);
    }  

    getChild() {
        return this;
    }

    msgStream(message) {
        process.send({ stream: message });
    }

    collectMetrics() {
        let count = 0;
        const interval = 10000; // 10 sec
        const retential_threshold = 60; // 10 min
        let usageCpu = process.cpuUsage();
        setInterval(()=>{
            usageCpu = process.cpuUsage(usageCpu)
            this.metrics.push({cpu: usageCpu, mem: process.memoryUsage()}) 
            count++
            if (count > retential_threshold) {
                this.metrics = []
                count = 0
                logger.debug(`Clear process: ${process.pid} metrics`)
            }
        },interval)
    }
}

module.exports = aWorker

new aWorker({
    version: (msg) => { 
        return new Promise((resolve) => resolve({ version: `versions 1.0`})) 
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
        logger.trace(`Worker: ${process.pid} | execute logic: ${msg.body.event} in mode:`, msg.body.mode);    
        return new Promise((resolve) => resolve(self.engine.emitEvent(msg.body.event,msg.body.mode,self.msgStream,msg.body.suid))) 
    },
    newevent: (msg,  self) => {
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
    }
}).init()


