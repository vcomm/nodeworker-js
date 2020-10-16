'use strict';

const EventEmitter = require('events');
const log4js = require('log4js');
const { setInterval } = require('timers');
const logger = log4js.getLogger('broker');
logger.level = 'trace';

class queueBroker extends EventEmitter {

    constructor(master,cfg) {
        super()
        this._cfg_    = cfg
        this._master_ = master
        this._topics_ = {}
        logger.trace(`Create queueBroker `) 
    }

    init() {
        this._cfg_.topics.forEach(topic => {
            this.newTopic(topic)
        });
        setInterval(()=> {
            for (var topic of Object.keys(this._topics_)) {                
                 this.retention(topic)
            }            
        },this._cfg_.retention.times)
    }

    pubsub(msg,wid) {
        if (msg.service === 'publish') {
            return this.add(msg.topic,msg.notice)
        } else if(msg.service === 'subscribe') {
            return msg.topics.map((topic)=>{
                return this.subscribeOn(topic, wid)
            })
        }        
    }

    newTopic(topic) {
        this._topics_[topic] = {
            offset: 0,
            queue : [],
            dests : []
        }
        logger.trace(`Create newTopic: ${topic}`)
    }

    delTopic(topic) {
        if (this._topics_[topic]) {
            delete this._topics_[topic]
            logger.trace(`Topic: ${topic} deleted`)
            return true
        } else {
            logger.warn(`Delete wrong topic: ${topic} name`)
            return false
        }
    }

    add(topic,msg) { // push to tail
        if (this._topics_[topic]) {
            this._topics_[topic].offset++
            this._topics_[topic].queue.push(msg)
            this.emit(topic,msg,this._topics_[topic].offset)
            logger.trace(`Add Msg to tail topic: ${topic} offset: ${this._topics_[topic].offset}`,msg)
            return true
        } else {
            logger.warn(`Add Msg to wrong topic: ${topic} name`)
            return false
        }
    }

    del(topic) { // shift from head 
        if (this._topics_[topic]) {
            this._topics_[topic].queue.shift()
            logger.trace(`Remove Msg from head topic: ${topic}`)
            return true
        } else {
            logger.warn(`Remove Msg from wrong topic: ${topic} name`)
            return false
        }
    }

    subscribeOn(topic, to) {
        if (this._topics_[topic]) {
            this._topics_[topic].dests.push(to)
            this.on(topic, (msg, offset) => {
                msg.topic  = topic
                msg.offset = offset
                this._topics_[topic].dests.map((to)=>{
                    this._master_.sendTo(to,msg)
                })
//                setTimeout(()=>this.retention(topic),this._cfg_.retention.times)
            })
            logger.trace(`Subscribe On topic: ${topic}, dest: ${to}`)
            return true
        } else {
            logger.warn(`Wrong subscribe On topic: ${topic}, dest: ${to}`)
            return false
        }
    }

    retention(topic) {
        if (this._topics_[topic].queue.length > this._cfg_.retention.qsize) {
            this.del(topic)
            logger.trace(`Clear tail topic: ${topic}`)
        }        
    }

    datablock(topic, from, range) {
        logger.trace(`Get topic ${topic} offset range: ${from}-${range}`)
        const offset = this._topics_[topic].queue.length-(range - from)
        return this._topics_[topic].queue.slice(offset)
    }
}

module.exports = {
    msgBroker: queueBroker,
    Logger   : logger
}