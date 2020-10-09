'use strict';

const log4js = require('log4js');
let   logger = log4js.getLogger(`:Message`);
logger.level = 'error';

class Message {
    constructor(name,events) {  
        this.requestIDs = {};
        this.seqRequest = 0;   
        this.onMessage = events || null;
        
        logger = log4js.getLogger(`${name}:Message`);
    }

    request(message) {
        try {
            let self = this;
            return new Promise(function(resolve, reject) {
                self.msgSend(self.requestPrepare(message,
                    (res) => {
                        resolve(res);
                    }));                        
                setTimeout(() => reject(`Request Timeout Error`), 5000);
            })
            .then((res) => {
                logger.trace(`Response Complete: ${res.id}`);
                return {code: 200, data: res, status: `Response Complete ${res.id}`};
            })  
            .catch(function(error) {
                if (error) logger.error(error)
                return {code: 522, data: { body: `Request Timeout Error` }, status: error};
            });   
        }
        catch(e) {
            // do nothing if there's an error.
            logger.error(`request error message: ${e} `);
        }             
    }

    requestPrepare(message,callback) {
        let request = message;

        if (callback != undefined && 
            callback != null) {
            request.id = this.seqRequest;
            //Save off the callback function
            this.requestIDs[this.seqRequest] = callback;
            //Make sure we don't exceed that max int in javascript
            if(this.seqRequest < Number.MAX_SAFE_INTEGER){ this.seqRequest++; }
            else{ this.seqRequest = 0; }
            logger.trace(`Origin Sending Request: ${request.head.origin} => ${request.id} => ${request.head.target}`);
        }
        return request;
    }

    response(message) {
        let ret = false;
        let msg = message;

        if (msg.head.request != undefined) {
            logger.trace(`Responce Proceed request: ${msg.id}`)
            this.responseProceed(msg);
            ret = true;
        } else if(msg.head.response != undefined) {
            logger.trace(`Responce Process request: ${msg.id}`)
            this.responseProcess(msg);
            ret = true;
        } else {
            logger.warn(`User define command : ${message} `);
        }

        return ret;
    }

    responseProcess(msg) {
        if (msg.id != undefined && 
            this.requestIDs.hasOwnProperty(msg.id)) {
            this.requestIDs[msg.id](msg);
            delete this.requestIDs[msg.id];   
            logger.trace(`Origin ${msg.head.origin} <= Response Processing: ${msg.id} from ${msg.head.target}`);
        } else {
            logger.warn(`Origin Response Processing can't find : ${msg.id} `);
        }  
    }

    responseProceed(msg) {
        let command = msg.head.request;
        if (command != undefined && msg.id != undefined &&
            this.onMessage && this.onMessage.hasOwnProperty(command)) {
            logger.trace(`Target ${msg.head.target} => Response Proceeding: ${msg.id} from ${msg.head.origin}`);    
            this.onMessage[command](msg,this.getChild())
                .then(result => { 
                    this.msgSend({ 
                        id  : msg.id,
                        head: {
                            target   : msg.head.origin,
                            origin   : msg.head.target,
                            response : command
                        }
                       ,body: result
                    });
                 })
        } else {
            logger.warn(`Target Response Command Proceeding ${command} is undefined`);    
        }
    }
    /** Implementation required */
    msgSend(message) {
        throw new Error('You have to implement the method doSomething!',message);
    }

    getChild() {
        throw new Error('You have to implement the method doSomething!');
    }
}

module.exports = {
    Message : Message,
    mLogger : logger
}