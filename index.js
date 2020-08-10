'use strict';

const bodyParser = require('body-parser')
const express = require('express');
const app = express();

const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('./swagger.json');
const adaptive = require('./server/engine')
const engine = new adaptive.aEngine('.././logic/')
engine.init(engine.load(require('./logic/main.json')), engine._cntn_)

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.use('/api', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

app.get('/', (req, res) => res.redirect('/api'));

app.get('/version', (req, res) => {
    res.json({ service: `Node Worker version`, responce: `NODE Adaptive Worker API versions 1.0`})            
})

app.get('/evlist', (req, res) => {
    res.json({ service: `Node Worker events list`, responce: engine.emitOn()})            
})

app.post('/attach', (req, res) => {
    if (req.body)
        res.json({ service: `Node Worker attach dafsm logic`, responce: engine.load(req.body)})
    else
        res.json({ service: `Node Worker attach dafsm logic`, responce: `Failed: Missing dafsm logic script in request body`})
})

app.delete('/logic/:evname', (req, res) => {   
    res.json({ service: `Node Worker dafsm delete logic by name`, responce: engine.delLogic(req.params.evname)}) 
})

app.get('/logics', (req, res) => {
    res.json({ service: `Node Worker dafsm get logics list`, responce: engine.getLogics()})            
})

app.get('/logics/:sname', (req, res) => {
    res.json({ service: `Node Worker dafsm get logic script by name`, responce: engine.getLogics(req.params.sname)})            
})

app.get('/exec/:evname', (req, res) => {   
    engine.emitEvent(req.params.evname,res)
})

app.post('/create/:evname', (req, res) => {
    if (req.body && req.body.func)
        res.json({ service: `Node Worker create new event[${req.params.evname}]`, responce: engine.emitOn(req.params.evname,req.body.func)}) 
    else
        res.json({ service: `Node Worker create new event[${req.params.evname}]`, responce: `Failed: Missing request body or/and body.func`})
})

app.delete('/event/:evname', (req, res) => {   
    res.json({ service: `Node Worker remove all listeners by event name`, responce: engine.removeEvent(req.params.evname)}) 
})

var template = 
`<!DOCTYPE html> <html> <body>
<textarea id="code"rows="10" cols="100">
{
"func": "console.debug(': Even drive on: PNETS'); return { status: true };"
}
</textarea>
<br><br>
<button type="button" onclick="codeObfuscate('code')">Attach</button>
<script type="text/javascript">
function codeObfuscate(elem) {
    var code = document.getElementById(elem).value;
    fetch('/create/pnets', {
        method: 'post',
        headers: {
            'Content-Type': 'application/json'
        },
        body: code
    })  
        .then(res => res.json())
        .then(resp => {             
            document.getElementById(elem).value = resp.responce
        })
        .catch(console.error.bind(console));
}
</script>
</body> </html>`;
app.get('/test', (req, res) => {
    res.send(template);
});

/*-----------------------------*/
const fs = require('fs');
const https = require('https');

const PORT = process.env.PORT || 5000;

const options = {
    key:   fs.readFileSync(__dirname + '/ssl/server.key'),
    cert:  fs.readFileSync(__dirname + '/ssl/server.crt')
}

const server = https
    .createServer(options,app)
    .listen(PORT, (error) => {
        if (error) {
            console.error(error)
            //throw new Error(err);
            return process.exit(1)
        } else {
            console.log('Listening on port: ' + PORT + '.')
            console.log("Node Worker now running on port", server.address())
        }
    })
/*
const http2 = require('http2');

const server = http2.createSecureServer(options);
server.on('stream', (stream, headers) => {
 // stream - это дуплексный поток
 // headers - это объект, содержащий заголовки запроса

 // команда respond отправит заголовки клиенту
 // мета-заголовки начинаются со знака двоеточия (:)
 stream.respond({ ':status': 200 });

 // тут, кроме того, доступны команды stream.respondWithFile()
 // и stream.pushStream()

 stream.end('Hello World!');
});

server.listen(PORT);
*/