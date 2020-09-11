'use strict';

const bodyParser = require('body-parser')
const express = require('express');
//const http = require('http');
//const app = express();

const process = require('process');
const cluster = require('cluster');
const swaggerUi = require('swagger-ui-express');
const cMaster = require('./server/master')
//const cMaster = require('./dist/server/master')

const log4js = require('log4js');
const logger = log4js.getLogger('cluster');
logger.level = 'trace';

const PORT = process.env.PORT || 5555

//const argv = process.argv.slice(2).reduce((a,b)=> (a[b]='',a),{});
const dir = process.argv.slice(2)[0]
logger.warn(`Command line arguments: `, dir)

const config  = require(dir+'config/config.json');
const swaggerDocument = require(dir+'swagger.json');
config.maxnumbers = require('os').cpus().length;

const folder = (dir === './') ? __dirname + '/public/dist' : __dirname + '/' + dir +'public/dist'
logger.error(`Frontend public folder: `,folder)

if (cluster.isMaster) {
    const master = new cMaster(cluster,config)

    express()
        .use(bodyParser.urlencoded({ extended: false }))
        .use(bodyParser.json())           
        .use(express.static(folder))  // Set public folder as root
//        .get('/', (req, res) => res.redirect('/api'))    
        .use('/api', swaggerUi.serve, swaggerUi.setup(swaggerDocument))
        .get('/version', (req, res) => {
            res.status(200).json({ 
                service: `Node Worker version`, 
                responce: { 
                    version: `versions 1.0`, 
                    suid: master.genuuid()
                }})            
/*            
            master.sendTo('1',{
                path: '/version',
                request: '',
                responce: ''
            })                      
            res.json({ service: `Node Worker version`, responce: `NODE Adaptive Worker API versions 1.0`})            

*/
        })
        .get('/subscribe/:suid', (req, res) => {        
            res.writeHead(200, {
                'Content-Type': 'text/event-stream', 
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive'
            });
            res.write('\n');
            master.subscribe(req,res,req.params.suid)
        })        
        .get('/evlist', async (req, res) => {
            const elst = await Promise.all(master._wpool_.map(
                async (id) => await master.request({ 
                    head: {
                        target  : id,
                        origin  : 'master',
                        request : 'evlist'
                    },
                    body: "The request by path /version"
                })
                .then(result => { 
                    logger.trace(`(${id})->`,result.data.body) 
                    return { worker: id, events: result.data.body}
                })
            ));
            res.json({ service: `Node Worker events list`, responce: elst})          
        })
        .get('/logics', async (req, res) => {
            const logics = await Promise.all(master._wpool_.map(
                async (id) => await master.request({ 
                    head: {
                        target  : id,
                        origin  : 'master',
                        request : 'logics'
                    },
                    body: "The request by path /logics"
                })
                .then(result => { 
                    logger.trace(`(${id})->`,result.data.body) 
                    return { worker: id, logics: result.data.body}
                })
            ));
            res.json({ service: `Node Worker dafsm get logics list`, responce: logics})           
        })
        .get('/logics/:sname/:workerid', (req, res) => {
            master.request({ 
                head: {
                    target  : req.params.workerid,
                    origin  : 'master',
                    request : 'getlogic'
                },
                body: req.params.sname
            })
            .then(result => { 
                logger.trace(`(${req.params.workerid})->`,result.data.body) 
                res.status(result.code).json({ service: `Node Worker dafsm get logic script by name`, responce: result.data.body }) 
            })            
        })
        .post('/attach/:workerid', (req, res) => {            
            if (req.body) {
                master.request({ 
                    head: {
                        target  : req.params.workerid,
                        origin  : 'master',
                        request : 'attach'
                    },
                    body: req.body
                })
                .then(result => { 
                    logger.trace(`(${req.params.workerid})->`,result.data.body) 
                    res.status(result.code).json({ service: `Node Worker attach dafsm logic`, responce: result.data.body }) 
                })
            } else
                res.json({ service: `Node Worker attach dafsm logic`, responce: `Failed: Missing dafsm logic script in request body`})
        })
        .get('/activate/:sname/:workerid', (req, res) => {
            master.request({ 
                head: {
                    target  : req.params.workerid,
                    origin  : 'master',
                    request : 'activate'
                },
                body: req.params.sname
            })
            .then(result => { 
                logger.trace(`(${req.params.workerid})->`,result.data.body) 
                res.status(result.code).json({ service: `Node Worker dafsm activate logic script by name on worker ${req.params.workerid}`, responce: result.data.body }) 
            })
        })
        .delete('/logic/:sname/:workerid', (req, res) => {   
            master.request({ 
                head: {
                    target  : req.params.workerid,
                    origin  : 'master',
                    request : 'dellogic'
                },
                body: req.params.sname
            })
            .then(result => { 
                logger.trace(`(${req.params.workerid})->`,result.data.body) 
                res.status(result.code).json({ service: `Node Worker dafsm delete logic script by name on worker ${req.params.workerid}`, responce: result.data.body }) 
            })
        })
        .get('/exec/:evname/:workerid/:mode/:suid', (req, res) => {   // mode: loop (interval) || step 
            master.request({ 
                head: {
                    target  : req.params.workerid,
                    origin  : 'master',
                    request : 'execute'
                },
                body: {event: req.params.evname, mode: req.params.mode, suid: req.params.suid}
            })
            .then(result => { 
                logger.trace(`(${req.params.workerid})->`,result.data.body) 
                res.status(result.code).json({ service: `Node Worker dafsm execute logic script by name on worker ${req.params.workerid}`, responce: result.data.body }) 
            })
        })
        .post('/create/:evname/:workerid', (req, res) => {
            if (req.body && req.body.func) {
                master.request({ 
                    head: {
                        target  : req.params.workerid,
                        origin  : 'master',
                        request : 'newevent'
                    },
                    body: {evname: req.params.evname, func: req.body.func}
                })
                .then(result => { 
                    logger.trace(`(${req.params.workerid})->`,result.data.body) 
                    res.status(result.code).json({ service: `Node Worker create new event[${req.params.evname}] on worker ${req.params.workerid}`, responce: result.data.body }) 
                })
            } else
                res.json({ service: `Node Worker create new event[${req.params.evname}]`, responce: `Failed: Missing request body or/and body.func`})
        })
        .delete('/event/:evname/:workerid', (req, res) => {   
            master.request({ 
                head: {
                    target  : req.params.workerid,
                    origin  : 'master',
                    request : 'delevent'
                },
                body: {evname: req.params.evname}
            })
            .then(result => { 
                logger.trace(`(${req.params.workerid})->`,result.data.body) 
                res.status(result.code).json({ service: `Node Worker remove all listeners by event[${req.params.evname}] on worker ${req.params.workerid}`, responce: result.data.body }) 
            })
        })   
        .get('/resources', async (req, res) => {   
            const metrics = await Promise.all(master._wpool_.map(
                async (id) => await master.request({ 
                    head: {
                        target  : id,
                        origin  : 'master',
                        request : 'metrics'
                    },
                    body: "The request by path /metrics"
                })
                .then(result => { 
                    logger.trace(`(${id})->`,result.data.body) 
                    return { worker: id, metric: result.data.body}
                })
            ));            
            res.json({ service: `Node Worker get resources metrics for all workers`, responce: { workers: master.resources, clients: Object.keys(master.clients), metrics: metrics }}) 
        })
        .get('/metrics/:workerid', (req, res) => {   
            master.request({ 
                head: {
                    target  : req.params.workerid,
                    origin  : 'master',
                    request : 'metrics'
                },
                body: "The request by path /metrics"
            })
            .then(result => { 
                logger.trace(`(${req.params.workerid})->`,result.data.body) 
                res.status(result.code).json({ service: `Node Worker get process metrics by worker ID`, responce: result.data.body }) 
            })             
        })     
        .listen(PORT, () => {
            logger.trace(`Web Server now running on port`, PORT);
        });

    master.init(dir)
    master.update(dir)

} else if (cluster.isWorker) {
    logger.trace(`Worker: ${process.pid} start`);
}

