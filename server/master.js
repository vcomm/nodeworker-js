'use strict';

const EventEmitter = require('events');
const { v4: uuidv4 } = require('uuid');
const Message = require('./message');
const log4js = require('log4js');
const logger = log4js.getLogger('master');
logger.level = 'trace';

class aMaster extends Message {

    constructor(cluster,config,events) {
        super('master',events);
        this._wpool_ = []
        this._cluster_ = cluster
        this._config_  = config || {
            setup : {
                exec: '/worker.js',
                args: ['--use', 'http']
            },
            numbers: 2,
            maxnumbers: 2,
            env : [
                { script: "logic/main.json" },
                { script: "logic/main.json" }
            ]         
        }  
        this.resources = {}  
        this.clients = {}; // <- Keep a map of attached clients    
        this.stream = new EventEmitter(); 
        this.stream.on("push", (id, data) => {
            if (this.clients[id]) {
                this.clients[id].res.write("data: " + JSON.stringify(data) + "\n\n");
                logger.debug("Update: monotoring :",data); 
            } else {
                logger.debug("Update pushing :",id); 
            }
        });        
        logger.trace(`Config cluster:\n`,this._config_); 
    } 

    init(dir) {
        const self = this;       
        logger.trace(`Master process ${process.pid} cluster setting up ${this._config_.numbers} workers...`);
        this._cluster_.on('online', function(worker) {
            logger.trace(`Worker[${worker.id}]: ` + worker.process.pid + ' is online');       
        });        
        this._cluster_.on('exit', function(worker, code, signal) {
            logger.trace('Worker ' + worker.process.pid + ' died with code: ' + code + ', and signal: ' + signal);
            logger.trace('Restarting a new worker');
            self._cluster_.fork();
        });    
        this._config_.setup.exec = __dirname + this._config_.setup.exec
        this._cluster_.setupMaster(this._config_.setup);     
        for(let worker,i = 0; i < this._config_.maxnumbers; i++) {   
            if (this._config_.env[i]) 
                this._config_.env[i].script = dir + this._config_.env[i].script
            logger.debug(`Proc Env: ${dir} `, this._config_.env[i])
            worker = this._cluster_.fork(this._config_.env[i] || {})
            worker.on('message', function(msg) {
                if (msg.chat) {
                    logger.trace(`Master recv msg: [${msg.chat.id}]:`, msg.chat.head);   
                    if (msg.chat.head) self.evMessage(msg.chat);  
                } else if (msg.stream) {
                    logger.debug(`Stream push:`,msg.stream)
                    self.stream.emit("push", msg.stream.suid, msg.stream)
                }         
            });
            if (this.resources[worker.id]) {
                self.resources[worker.id].pid = worker.process.pid
                this.resources[worker.id].status = this._config_.env[i] ? 'used' : 'free'
            } else {
                self.resources[worker.id] = { 
                    pid : worker.process.pid,
                    status : this._config_.env[i] ? 'used' : 'free' 
                }
            }
        }
    }

    update(dir) {
        for (const id in this._cluster_.workers) {
             logger.trace(`Master send msg to: `, id);              
             this._cluster_.workers[id].send({ chat: 'Updatepath', path: dir })
             this._wpool_.push(id)
        }
    }

    sendTo(to,message) {
        this._cluster_.workers[to].send({ chat: message })
    }
    
    msgSend(message) {
        const to = `${message.head.target}`
        if (to > 0 && to <= this._config_.maxnumbers) {
            logger.trace(`Master send msg to: `, to); 
            this._cluster_.workers[to].send(message)
        } else logger.error(`Master send msg to wrong worker ID: `, to); 
    }

    evMessage(message) {
        return super.response(message);
    }    

    getChild() {
        return this;
    }

    genuuid() {
        const suid = uuidv4()
        if (this.clients.hasOwnProperty(suid)) {
            this.genuuid()
        } else {
            return suid
        }
    }

    subscribe(req, res, suid) {
        const self = this;  
        (function (clientId) {
            self.clients[clientId] = { 
                res : res // <- Add this client to those we consider "attached"
            }
            req.on("close", function () {
                delete self.clients[clientId]
                console.log(`Destroy SSE session: ${clientId}`) 
            }); // <- Remove this client when he disconnects
            
            self.stream.emit("push", clientId, { subscribe : clientId });
        })(suid)    
    }
}

module.exports = aMaster