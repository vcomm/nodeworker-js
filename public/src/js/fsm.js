'use strict';

class jsonAction {
    /* Constructor */
    constructor(name,code) {
        this.pattern = code ? {
            name: name,
            func: code            
        } : {
            name: name
        }
    }     
    get() { return this.pattern } 
    addfunc(code) { 
        this.pattern.func = code
    }
}

class jsonTrans {
    /* Constructor */
    constructor(name,nextstate,trans) {
        this.pattern = trans ? trans :
        {
            key: name,
            nextstatename: nextstate,
            triggers: [],
            effects: []            
        }
    }   
    get() { return this.pattern }  
    addtrigger(name, code) {
        this.pattern.triggers.push((new jsonAction(name, code)).get())
    } 
    addeffect(name, code) {
        this.pattern.effects.push((new jsonAction(name, code)).get())        
    } 
}

class jsonState {
    /* Constructor */
    constructor(key,name,type) {
        this.transDict = {}
        this.pattern = {
            key: key,
            name: name                 
        }
        switch(type) {
            case 'initialState':
                this.pattern.key = 'init'
                this.pattern.exits = [] 
                this.pattern.transitions = []   
                break;
            case 'finalState':
                this.pattern.entries = []
                break;
            default:    
                this.pattern.entries = []
                this.pattern.stays = []
                this.pattern.exits = []     
                this.pattern.transitions = [] 
        }
    }  
    get() { return this.pattern }
    setsuperstate(link) {
        this.pattern.superstate = {
            link: link
        }
    }
    addentry(name, code) {
        if (this.pattern.hasOwnProperty("entries")) {
            let item = this.pattern.entries.find(obj => obj.name == name)
            if (item === undefined) {
                let action = new jsonAction(name, code)
                this.pattern.entries.push(action.get())    
                return action
            } else {
                item.func = code
                return null
            }
        } else return null        
    }
    addexit(name, code) {
        if (this.pattern.hasOwnProperty("exits")) {
            let action = new jsonAction(name, code)
            this.pattern.exits.push(action.get())  
            return action 
        } else return null    
    }
    addstay(name, code) {
        if (this.pattern.hasOwnProperty("stays")) {
            let action = new jsonAction(name, code)
            this.pattern.stays.push(action.get())  
            return action  
        } else return null     
    }    
    addtrans(name,nextstate) {
        if (this.pattern.hasOwnProperty("transitions")) {
            let trans = new jsonTrans(name,nextstate)
            this.pattern.transitions.push(trans.get())  
            this.transDict[name] = trans 
            return trans    
        } else return null
    }   
    deltrans(name) {
        if (this.pattern.hasOwnProperty("transitions")) {
            const translst = this.get().transitions  
            for(var i = 0; i < translst.length; i++) {
                const trans = translst[i]
                if(trans.key === name) {
                   translst.splice(i, 1)
                   if(this.transDict.hasOwnProperty(name)) {
                      delete this.transDict[name]                      
                   }
                   return true
              }
            }
        } 
        return false       
    }  
    clonetrans(transition) {
        if (this.pattern.hasOwnProperty("transitions")) {
            let trans = new jsonTrans('','',JSON.parse(JSON.stringify(transition)))
            this.pattern.transitions.push(trans.get())   
            return trans    
        } else return null        
    }
}

class jsonFSA {
    /* Constructor */
    constructor(id,project) {
        this.pattern = {
            id: id,
            type: "FSM",
            prj: project,
            complete: false,
            start: {},
            stop: {},
            countstates: 0,
            //states: []  
            states: {}          
        }
        this.statesDict = {}
        this.stroke = [
            '#d0c4f4',
            '#f46b6d',
            '#5d8dbe',
            '#F4D03F',
            '#66bc84',
            '#e6b362',
            '#80c5e2'
        ]
    }   
    get() { return this.pattern }
    addstate(key,name,type) {
    /*    
        let state = this.pattern.states.push((new jsonState(key,name,type)).get()) 
        this.pattern.countstates ++
        return this.pattern.states[state-1]
    */    
        let state = new jsonState(key,name,type)
        this.pattern.states[key] = state.get()
        this.pattern.countstates ++
        this.statesDict[key] = state
        return state
    }
    delstate(key) { 
    /*           
        let item = null
        for (let i=0; i<this.pattern.states.length; i++) {
            item = this.pattern.states[i]
            if (item.key === key) {
                this.pattern.states.splice(i, 1)
                break
            }
        } 
    */     
        if (this.pattern.states.hasOwnProperty(key)) {
            delete this.pattern.states[key]
            this.pattern.countstates -- 
            if (this.statesDict.hasOwnProperty(key))
                delete this.statesDict[key]
        }                       
    }
    addstart(name, code) {
        this.pattern.start = (new jsonAction(name, code)).get()  
    }
    addstop(name, code) {
        this.pattern.stop = (new jsonAction(name, code)).get()
    }
    genColor() {        
        const letters = '0123456789ABCDEF';
        let color = '#';
        for (let i = 0; i < 6; i++) {
            color += letters[Math.floor(Math.random() * 16)];
        }
        return color;    
    }    
}

import '@scripts/codemirror/lib/codemirror.css'
import CodeMirror from 'codemirror'
import '@scripts/codemirror/mode/javascript/javascript'

class codeEditor {
    /* Constructor */
    constructor(elcode,cblk) {
        this.editor = CodeMirror(elcode,{
//            lineNumbers: true,
            lineWrapping: true,
            mode: "text/javascript"
        });
        this.editor.on('change',cblk);
/*        
        this.editor.on('change',function(cMirror){            
            console.log('Change Editor code',cMirror.getValue());
        });   
*/             
        this.editor.setSize("100%", "90%");
    }

    set(value,bfree) {
        bfree ? this.editor.setValue(this.formatCode(value)) : this.editor.setValue(this.formatJson(JSON.stringify(value)));
    }
    get() {
        return this.editor.getValue()
    }
    repeat(s, count) {
        return new Array(count + 1).join(s);
    }
    formatCode(code) {
        let newCode     = "",
            tab         = "    ",
            indentLevel = 0,
            currentChar = null;
        
        for (let i = 0, il = code.length; i < il; i += 1) {
            currentChar = code.charAt(i);
             switch(currentChar) {
                case ';':
                    newCode += ";\n" + this.repeat(tab, indentLevel);
                    break;                 
                 default:
                    newCode += currentChar + this.repeat(tab, indentLevel);
                    break;
             }
        }
        return newCode
    }
    formatJson(json) {
        var i           = 0,
            il          = 0,
            tab         = "    ",
            newJson     = "",
            indentLevel = 0,
            inString    = false,
            currentChar = null;
    
        for (i = 0, il = json.length; i < il; i += 1) {
            currentChar = json.charAt(i);
    
            switch (currentChar) {
            case '{':
            case '[':
                if (!inString) {
                    newJson += currentChar + "\n" + this.repeat(tab, indentLevel + 1);
                    indentLevel += 1;
                } else {
                    newJson += currentChar;
                }
                break;
            case '}':
            case ']':
                if (!inString) {
                    indentLevel -= 1;
                    newJson += "\n" + this.repeat(tab, indentLevel) + currentChar;
                } else {
                    newJson += currentChar;
                }
                break;
            case ',':
                if (!inString) {
                    newJson += ",\n" + this.repeat(tab, indentLevel);
                } else {
                    newJson += currentChar;
                }
                break;
            case ':':
                if (!inString) {
                    newJson += ": ";
                } else {
                    newJson += currentChar;
                }
                break;
            case ' ':
            case "\n":
            case "\t":
                if (inString) {
                    newJson += currentChar;
                }
                break;
            case '"':
                if (i > 0 && json.charAt(i - 1) !== '\\') {
                    inString = !inString;
                }
                newJson += currentChar;
                break;
            default:
                newJson += currentChar;
                break;
            }
        }
    
        return newJson;
    }
}

import * as $ from 'jquery'
import "@scripts/jointjs/dist/joint.css"
import * as joint from 'jointjs'

export default class umlFsm extends jsonFSA {
    /* Constructor */
    constructor(elpaper,id,project,editor) {
        super(id,project)
        this.selected = null;
        this.graph = new joint.dia.Graph({},{ cellViewNamespace: joint.shape });
        this.paper = new joint.dia.Paper({
            el: $(elpaper),
            width: $(elpaper).parent().width(),
            height: $(elpaper).parent().height(),
            gridSize: 1,
            model: this.graph,
            cellViewNamespace: joint.shapes
        });       
        this.uml = joint.shapes.uml;      
        this.editor = new codeEditor(editor.elem,editor.cblk)         
    }

    init(jsoned) {
        const self = this
        this.jsonedit = jsoned
        this.graph.on('remove', function(cell) {
            let fsa = self.jsonedit.get()
            switch (cell.fsa.type) {
            case 'trans':
              const owner = cell.fsa.owner.pattern
              const remtrans = cell.fsa.item.get().key
              console.log(`Remove from Owner ${JSON.stringify(cell.fsa.owner)} Transition: ${JSON.stringify(cell.fsa.item.get())}`);
              cell.fsa.owner.deltrans(cell.fsa.item.get().key)
              if (fsa.states.hasOwnProperty(owner.key)) {
                if (fsa.states[owner.key].hasOwnProperty("transitions")) {
                    const translst = fsa.states[owner.key].transitions  
                    for(var i = 0; i < translst.length; i++) {
                        const trans = translst[i]
                        if(trans.key === remtrans) {
                           translst.splice(i, 1)
                      }
                    }
                }
                self.jsonedit.set(fsa)
              }
              break;
            case 'state':
              const key = cell.fsa.item.get().key  
              console.log('Remove State: ',cell.fsa.item.get());  
              self.delstate(key)
              if (fsa.states.hasOwnProperty(key)) {
                  delete fsa.states[key]
                  fsa.countstates -- 
                  self.jsonedit.set(fsa)
              }              
              break;
            }
        });          
        this.graph.on('change:source', function(trans) {
            //console.log('source of the link changed',trans);
            if (trans.attributes.source.id)
                self.changeTransSrc(trans)
        });          
        this.graph.on('change:target', function(trans) {      
            /*                  
            if (trans.attributes.target.id) {
                const newTargetID = trans.attributes.target.id
                const newtarget = self.graph.getCell(newTargetID)
                const oldtargetkey = trans.fsa.item.pattern.nextstatename
                //trans.fsa.item.pattern.key.replace(`${oldtargetkey}`, `${newtarget.fsa.item.pattern.key}`)
                trans.fsa.item.pattern.key = `T:${trans.fsa.owner.pattern.key}=>${newtarget.fsa.item.pattern.key}`
                trans.fsa.item.pattern.nextstatename = newtarget.fsa.item.pattern.key
                console.log(`target of the link changed to ${trans.fsa.item.pattern.nextstatename}:`,trans,newtarget);
                console.log(`updated FSA`,self.get().states)
            }
            */
           self.changeTransDst(trans)
        });
        this.paper.on('cell:pointerdown',function(cellView){
            if (self.selected) 
                self.selected.attr({
                    rect: { fill: 'rgba(48, 208, 198, 0.1)' },
                    text: { fill: 'black', 'font-size': 15 }
                });
            cellView.model.attr({
              rect: { fill: 'yellow' },
              text: { fill: 'black', 'font-size': 15 }
            });
            self.selected  = cellView.model;
            if (self.selected.fsa.type === 'state') {
                self.showhide(['.state'],['.paper','.trans'])
                if (self.selected.fsa.item.pattern.key === 'init')
                    self.showhide([],['.init'])
                if (self.selected.fsa.item.pattern.key === 'final')
                    self.showhide([],['.final'])
            } else if (self.selected.fsa.type === 'trans') {
                self.showhide(['.trans'],['.paper','.state'])
            } else
                self.showhide([],['.paper','.state','.trans'])    

            console.log('selected '+self.selected.fsa.type,self.selected.fsa.item)
            $('code#selectedItem').text(self.selected.fsa.item.pattern.key)
        });
        this.paper.on('blank:pointerdown', function() {
            if(self.selected) {
                self.selected.attr({
                    rect: { fill: 'rgba(48, 208, 198, 0.1)' },
                    text: { fill: 'black', 'font-size': 15 }
                });
                self.selected  = null;
                self.showhide(['.paper'],['.state','.trans'])
                console.log('Reset All')
                $('code#selectedItem').text('Not Selected')
            }
        });
        this.paper.on('cell:pointerclick', function(cellView, eventObject, eventX, eventY) {
            console.log(`cell:pointerclick - x[${eventX}], y[${eventY}]`)
        }); 
        this.paper.on('cell:pointerdblclick', function(cellView) {
//            self.sellShow()
//            self.editor.set(cellView.model.fsa.item.get());
            console.log('Show State:',cellView.model.fsa.item.get());
        });        
        this.paper.on('element:contextmenu', function(cellView) {
            console.log('Rigth Click Context Menu:');
        })       
    }

    getSelectedItem() {
        if(this.selected)
            return { type: this.selected.fsa.type, name: this.selected.fsa.item.pattern.key }
        else
            return null
    }

    sellShow() {
        $('#dialog').css({display :'block'});
        $('#Code').css({display :'block'});
        $('.modal-content').css({height: '70%',width: '70%'});
    }

    showhide(showlist,hidelist) {
        showlist.forEach(function(item, i, arr) {
            $(item).css({display :'block'});
        });    
        hidelist.forEach(function(item, i, arr) {
            $(item).css({display :'none'});
        });            
    }    

    addAction(type,actname,actfunc) {
        const item = this.getSelectedItem()
        if (!item) return
        const objItem = this.selected.fsa.item
        switch(item.type) {
            case 'state':       
                let events = this.selected.get('events')
                switch (type) {
                    case 'entries':
                        let entries = JSON.parse(events[0])
                        entries.entries++
                        this.selected.set('events', [JSON.stringify(entries),events[1],events[2]])
                        //this.statesDict[item.name].addentry(actname,actfunc)
                        objItem.addentry(actname,actfunc)
                        break;
                    case 'stays':
                        let stays = JSON.parse(events[1])
                        stays.stays++
                        this.selected.set('events', [events[0],JSON.stringify(stays),events[2]])
                        //this.statesDict[item.name].addstay(actname,actfunc)
                        objItem.addstay(actname,actfunc)
                        break;
                    case 'exits':
                        let exits = JSON.parse(events[2])
                        exits.exits++
                        this.selected.set('events', [events[0],events[1],JSON.stringify(exits)])  
                        //this.statesDict[item.name].addexit(actname,actfunc)    
                        objItem.addexit(actname,actfunc)           
                        break;    
                } 
                break;
            case 'trans':
                switch (type) {
                    case 'triggers':
                        objItem.addtrigger(actname,actfunc)
                        break;
                    case 'effects':
                        objItem.addeffect(actname,actfunc)
                        break;    
                }
                break; 
        }      
    }

    makeState(type,stateName) {
        let uml = this.uml
        let fsa = this.jsonedit.get()
        let state = null, fsaState = null;
        const delta = (10*this.get().countstates)

        switch(type) {
            case 'initialState':
                state = new uml.StartState({
                    position: { x:150  , y: 20 },
                    size: { width: 30, height: 30 },
                    attrs: {
                        'circle': {
                          fill: '#4b4a67',
                          stroke: 'none'
                        }
                    }
                });
                fsaState = this.addstate('init',stateName,type)
                fsa['states']['init'] = fsaState.pattern
                break;
            case 'finalState':
                state = new uml.EndState({
                    position: { x:750  , y: 550 },
                    size: { width: 30, height: 30 },
                    attrs: {
                        '.outer': {
                           stroke: "#4b4a67",
                          'stroke-width': 2
                        },
                        '.inner': {
                           fill: '#4b4a67'
                        }
                    }
                });
                fsaState = this.addstate('final',stateName,type)
                fsa['states']['final'] = fsaState.pattern
                break;
            default:
                const color = this.genColor()
                state = new uml.State({
                    position: { x:500+delta, y:50+delta },
                    size: { width: 150, height: 80 },
                    name: stateName,
                    events: ['{"entries":0}','{"stays":0}','{"exits":0}'],
                    attrs: {
                        '.uml-state-body': {
                           fill: 'rgba(48, 208, 198, 0.1)',
                           //stroke: '#4b4a67',
                           //stroke: this.stroke[this.get().countstates],
                           stroke: color,
                          'stroke-width': 3.0
                        },
                        '.uml-state-separator': {
                           //stroke: '#4b4a67'
                           //stroke: this.stroke[this.get().countstates],
                           stroke: color
                        }
                    }                    
                });
                fsaState = this.addstate(stateName,stateName,type)
                fsa['states'][stateName] = fsaState.pattern
//                state.set('events', ['entries','stays','exits']);
        }

        fsa.countstates ++
        this.jsonedit.set(fsa)

        fsaState.get().model = state
        state.fsa = { type: 'state', item: fsaState}
        this.graph.addCell(state)   
        console.log(`${stateName}[${state.id}]`,state)   
    }

    sellRemove() {
        if(this.selected) this.selected.remove();
    }    
    
    transLink(source, target, stroke, label, vertices) {
        return new joint.shapes.fsa.Arrow({
            source: { id: source.id },
            target: { id: target.id },
            attrs: {
                line: {
                    strokeWidth: 2,
                    stroke: stroke
                }
            },
            labels: [{
                position: {
                    distance: 0.5,
                    offset: (label.indexOf('\n') > -1 || label.length === 1) ? 0 : 10,
                    args: {
                        keepGradient: true,
                        ensureLegibility: true
                    }
                },
                attrs: {
                    text: {
                        text: label,
                        fontWeight: 'bold'
                    }
                }
            }],
            vertices: vertices || []
        });               
    }

    makeTrans(src,dst) {
        let uml = this.uml
        let fsa = this.jsonedit.get()
        const transName = `T:${src}=>${dst}`
        const srcState = this.get().states[src]
        const dstState = this.get().states[dst]
        const label = transName
        
        let trans = new uml.Transition({
            source: { id: srcState.model.id },
            target: { id: dstState.model.id },
            attrs: {'.connection': {
                'fill': 'none',
                'stroke-linejoin': 'round',
                'stroke-width': '2',
                'stroke': (src === 'init') ? "#4b4a67" : srcState.model.attributes.attrs['.uml-state-body'].stroke
                },
                '.marker-arrowheads': {
                    display: 'none'
                }
            },
            labels: [{
                position: {
                    distance: 0.5,
                    offset: (label.indexOf('\n') > -1 || label.length === 1) ? 0 : 10,
                    args: {
                        keepGradient: true,
                        ensureLegibility: true
                    }
                },
                attrs: {
                    text: {
                        text: label,
                        fontWeight: 'bold'
                    }
                }
            }]            
        });     
        /*
        let trans = this.transLink(srcState.model, dstState.model, 
            srcState.model.attributes.attrs['.uml-state-body'].stroke, label)
        */
        let fsaTrans = srcState.model.fsa.item.addtrans(transName,dstState.key)
        fsa['states'][src]['transitions'].push(fsaTrans.pattern)
        this.jsonedit.set(fsa)
        //fsaTrans.model = trans
        fsaTrans.get().model = trans
        trans.fsa = { type: 'trans', item: fsaTrans, owner: srcState.model.fsa.item}
        this.graph.addCell(trans);
        console.log(`${src}[${srcState.model.id}] => ${dst}[${dstState.model.id}]`,trans)  
    }

    changeTransDst(trans) {
        if (trans.attributes.target.id) {
            const newTargetID = trans.attributes.target.id
            const newTarget = trans.graph.getCell(newTargetID)
            //const oldtargetkey = trans.fsa.item.pattern.nextstatename
            //trans.fsa.item.pattern.key.replace(`${oldtargetkey}`, `${newTarget.fsa.item.pattern.key}`)
            trans.fsa.item.pattern.key = `T:${trans.fsa.owner.pattern.key}=>${newTarget.fsa.item.pattern.key}`
            trans.fsa.item.pattern.nextstatename = newTarget.fsa.item.pattern.key
            console.log(`target of the link changed to ${trans.fsa.item.pattern.nextstatename}:`,trans,newTarget);
            console.log(`updated FSA`,this.get().states)
        }
    }

    changeTransSrc(trans) {
        const newSourceID = trans.attributes.source.id
        const newSource   = trans.graph.getCell(newSourceID)
        const oldOwnerKey = trans.fsa.owner.pattern.key
        const newOwnerKey = newSource.fsa.item.pattern.key
        if (oldOwnerKey !== newOwnerKey) {
            const fsaOldSource = this.get().states[oldOwnerKey]
            const fsaNewSource = this.get().states[newOwnerKey]
            const removedTranKey = trans.fsa.item.pattern.key
            let remTrans = fsaOldSource.model.fsa.item.deltrans(removedTranKey)
            if (Array.isArray(remTrans)) {
                remTrans = remTrans[0]
                remTrans.key = `T:${newOwnerKey}=>${trans.fsa.item.pattern.nextstatename}`
                fsaNewSource.model.fsa.item.clonetrans(remTrans/*trans.fsa.item.pattern*/)
                trans.fsa.item.pattern.key = remTrans.key
                trans.fsa.owner = fsaNewSource.model.fsa.item
                console.log(`source of the link changed and updated FSA`,this.get().states)
            } else {
                trans.remove();
                console.log(`source of the link changed failed, was deleted`,this.get().states)
            }
        }
    }
    // Restore Graph utils
    restoreState(jsonState) {
        let uml = this.uml
        const typeState = {
            StartState : function(jsonState,fsa) {
                const state = new uml.StartState(jsonState.model)
                const fsaState = fsa.addstate('init',jsonState.name,type)
                fsaState.get().model = state
                state.fsa = { type: 'state', item: fsaState}
                return state
            },
            EndState  : function(jsonState,fsa) {
                const state = new uml.EndState(jsonState.model)
                const fsaState = fsa.addstate('final',jsonState.name,type)
                fsaState.get().model = state
                state.fsa = { type: 'state', item: fsaState}
                return state
            },
            State     : function(jsonState,fsa) {
                const state = new uml.State(jsonState.model)
                const fsaState = fsa.addstate(jsonState.key,jsonState.name,type)
                fsaState.get().model = state
                state.fsa = { type: 'state', item: fsaState}
                return state
            }
        }
        const type = jsonState.model.type.substring(jsonState.model.type.indexOf('.')+1)
        console.log(`Restore State: `, jsonState.model)
        this.graph.addCell(typeState[type](jsonState,this)) 
    }
    restoreTrans(model,srcState,dstKey,transName) {
        let uml = this.uml
        const trans = new uml.Transition(model)
        const fsaTrans = srcState.addtrans(transName,dstKey)
        fsaTrans.get().model = trans
        trans.fsa = { type: 'trans', item: fsaTrans, owner: srcState}
        console.log(`Restore Trans: `, model)
        this.graph.addCell(trans) 
    }
    restoreGraph(states) {
        if (states instanceof Object) {
            for (let [key, state] of Object.entries(states)) {
                if (state.hasOwnProperty("model"))
                    this.restoreState(state)
            }     
            for (let [key, state] of Object.entries(states)) {
                if (state && state.hasOwnProperty("transitions")) {
                    state.transitions.forEach(trans => {
                        if (trans.hasOwnProperty("model"))
                            this.restoreTrans(
                                trans.model,
                                this.statesDict[state.key],
                                trans.nextstatename,
                                trans.key)
                    })                        
                } 
            } 
        } else {
            console.warn(`Cannon Restore old style format`)
        }  
    }
    printAtomsList(states,start,stop) {
        let lstAtoms = [start,stop]

        for(let key of Object.keys(states)) {
            let state = states[key];
            if (state.hasOwnProperty("exits")) {
                state.exits.forEach(action => {
                    lstAtoms.push(action)
                })
            }
            if (state.hasOwnProperty("stays")) {
                state.stays.forEach(action => {
                    lstAtoms.push(action)
                })
            }
            if (state.hasOwnProperty("entries")) {
                state.entries.forEach(action => {
                    lstAtoms.push(action)
                })
            }
            if (state.hasOwnProperty("transitions")) {
                state.transitions.forEach(trans => {
                    if (trans.hasOwnProperty("triggers")) {
                        trans.triggers.forEach(trig => {
                            lstAtoms.push(trig)
                        })
                    }
                    if (trans.hasOwnProperty("effects")) {
                        trans.effects.forEach(eff => {
                            lstAtoms.push(eff)
                        })
                    }
                })
            }
        }

        return lstAtoms
    }
}
