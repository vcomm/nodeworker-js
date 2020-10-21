'use strict';

import * as $ from 'jquery'
import 'popper.js'
import 'bootstrap'
import 'bootstrap/dist/css/bootstrap.min.css'
import '@fortawesome/fontawesome-free/js/all'

import initDafsmTemplate from '../json/dafsm.json'
//import log from '../img/eyes-on.png'
//import '../lib/css/jsoneditor.css'
import "@scripts/jsoneditor/dist/jsoneditor.min.css"
import '../css/index.css'

import * as JSONEditor from 'jsoneditor'
import wStorage from '../js/wstorage'
import wProject from '../js/project'
import umlFsm from '../js/fsm'
import nodeTarget from '../js/cluster'
import jsonTools from '../js/jsontools'

let uml = null;
let editor = null;
let lstorage = null;
let sstorage = null;
let project = null;
let jtools  = null;

const cluster = new nodeTarget('/');

const monitor = (function (target) {
    const elem = $(target)
    return {
        prnInit: (msg)=>{
            elem
             .append(`<a href="#!" class="list-group-item list-group-item-action">${msg}</a>`)
             .scrollTop(250);
        },
        prnStepLog: (msg,worker)=>{
            let dt = new Date()
            const count = parseInt(elem.attr("count"))+1
            dt = dt.getHours() + ":" + dt.getMinutes() + ":" + dt.getSeconds()
            elem
             .append(`
            <div class="card">
                <div class="card-header" role="tab" id="heading${count}">
                <h5 class="mb-0" ondblclick="">
                    <a data-toggle="collapse" href="#collapse${count}" aria-expanded="true" aria-controls="collapse${count}">
                    ${dt} | [#${worker}] STEP-${count}: State(${msg.currState}) => State(${msg.nextState})
                    </a>
                </h5>
                </div>
                <div id="collapse${count}" class="collapse" role="tabpanel" aria-labelledby="heading${count}">
                <div class="card-body" style="padding: 0.25rem;">
                           ${monitor.prnExecSeq(msg)}
                </div>
                </div>
            </div>`)
             .attr("count",`${count}`)
        },
        prnExecSeq: (msg)=>{
            let ret = `<ul style="color:green">`

            for (let [key, func] of Object.entries(msg.prnlog)) {
                ret +=`<li>${key}</li>`
                func.forEach((log, index, array) => {
                    ret +=`<p style="color:red">${log}</p>`
                })
            }
     
            ret +=`</ul>`
            return ret
        }
    }
})("div#monitor")        

window.onbeforeunload = function(e) {
    lstorage.set(JSON.stringify(uml.jsonedit.get()/*uml.get()*/))
    e.returnValue = `Goodbye, Come again`;
    return `Goodbye, Come again`;
};

$(function() {
    $('body').css({display :'block'})
    $('div.navigation').click(()=>openNav())
    $('div#monitor').dblclick(()=>{
        const mon = $('div#monitor').get( 0 );
        if (mon.style.height === "6%") {         
            mon.style.height = "250px";
//            mon.style.width = "70%";
       } else {	  
            mon.style.height = "6%";
//            mon.style.width = "99.8%";
       }        
    })
    project = new wProject('myproj')
    lstorage = new wStorage(true,'dafsm',(data)=>{ 
        uml.jsonedit.set(JSON.parse(data))
    })
    lstorage.init()
    sstorage = new wStorage(false,'workers',(data)=>{})
    uml = new umlFsm('div#graph-body','tst','project',{
        elem: document.getElementById("code-body"),
        cblk: (cMirror) => {
            const code = cMirror.getValue()
            const funcname = $('a#code-edit-tab').children('b').text();
            if (funcname !== 'Editor') {
                $(`div#body-${funcname}`).text(code)
                $(`div#card-${funcname}`).css({ 'background-color': 'lightpink' })  
                console.log(`Change ${funcname} code: `,code);
            } else {
                console.log(`Not assigned Change ${funcname} code: `,code);
            }
        }
    })
    uml.init(initJSONeditor("jsoneditor"))
    const restore = JSON.parse(lstorage.get())
    if (restore) {
        uml.jsonedit.set(restore)
        uml.restoreGraph(restore.states) 
        $('i#graphDiagram').text(` ${restore.prj}${restore.id}`)
        uml.printAtomsList(restore.states,restore.start,restore.stop)
            .forEach((atom) => 
                showAtom(atom.name,
                        (atom.func === undefined) ? undefined : atom.func,
                        (atom.func === undefined) ? false : true)
            )
    } 

    // Connect to cluster
    cluster.subscribe((json) => {
        console.log(`Subscribe: `,json)

        cluster.monitor(
            (msg)=>monitor.prnInit(msg),
            (msg,process)=>monitor.prnStepLog(msg,process),
            (msg,worker)=>{ console.info(`Health worker ${worker} Chart`, msg)})

        // Get Target's process logics
        cluster.request({        
            method  : 'get',
            service : 'resources',
            params  : []
        },json => {
            console.log(`Target process resources: `,json)
            const workerlist = $("ul#clusterWorker")
//            sstorage.set(JSON.stringify(json.workers))
            for (let [key, worker, table, color] of Object.entries(json.workers)) {
//                status = (worker.status === 'used') ? 'list-group-item-info' : 'list-group-item-warning'                
                worker.color = color = uml.stroke[key]
                table = worker.resources.logics.map((item,i)=>{
                    return `
                    <tr id="logic-${key}-${item}">
                    <th scope="row">
                        <div class="form-check">
                            <input class="form-check-input position-static" type="radio" name="selLogic" id="" value="${i}" onclick="selectLogicByName('td#${key}-${item} > button.logicAction')">
                        </div>
                    </th>
                    <td>${item}</td>
                    <td id="${key}-${item}">
                        <button type="button" class="btn btn-success logicAction" onclick="loadLogic('${item}','${key}')" title="Load Logic" disabled><i class="fas fa-download"></i></button>
                        <button type="button" class="btn btn-info logicAction" onclick="activeLogic('${item}','${key}')" title="Activate Logic" disabled><i class="fas fa-exclamation-triangle"></i></button>
                        <button type="button" class="btn btn-primary logicAction" onclick="stepLogic('${key}','step')" title="Run Step Logic" disabled><i class="fas fa-step-forward"></i></button>
                        <button type="button" class="btn btn-warning logicAction" onclick="stepLogic('${key}',1000,this)" title="Exec Loop Logic" disabled><i class="fas fa-play"></i></button>                        
                        <button type="button" class="btn btn-danger logicAction" onclick="delLogic('${item}','${key}')" title="Delete Logic" disabled><i class="fas fa-trash-alt"></i></button>
                    </td>
                </tr>`
                })
/*   Reserved for future implementation
                <div class="dropdown-menu">
                  <a class="dropdown-item" href="/" onclick="" title="disabled">Get Logics</a>
                  <a class="dropdown-item" href="/" onclick="" title="disabled">Get Events</a>
                  <a class="dropdown-item" href="/" onclick="getMetrics('${key}')" title="Get Worker Metrics (disabled)">Get Metrics</a>
                  <a class="dropdown-item" href="#" onclick="attachLogic('${key}')" title="Attach Logic to Worker">Attach Logic</a>
                  <a class="dropdown-item" href="/" onclick="eventCreate('${key}')" title="Create Worker Event (disabled)">Create Event</a>
                  <a class="dropdown-item" href="/" onclick="eventDelete('${key}')" title="Delete Worker Event (disabled)">Delete Event</a>
                </div>
*/
                workerlist.append(`
                <li class="list-group-item list-group-item-action nav-item dropdown" data-toggle="collapse" data-target="#accordion-${key}" class="clickable" style="display: flex;background-color: ${color};">
                <b>Worker #${key} pid #${worker.pid}[${worker.status}]</b> 
                <a class="nav-link" data-toggle="dropdown" href="#" role="button" aria-haspopup="true" aria-expanded="false" style="padding-top: initial;margin-left: auto;">
                <i class="fas fa-ellipsis-v fa-sm fa-fw text-gray-400"></i>
                </a>
                <div class="dropdown-menu">
                  <a class="dropdown-item" href="#" onclick="attachLogic('${key}')" title="Attach Logic to Worker">Attach Logic</a>
                </div>
                </li>
                <div id="accordion-${key}" class="collapse">
                    <table class="table table-hover">
                    <thead>
                        <tr>
                            <th scope="col">#</th>
                            <th scope="col">Logic</th>
                            <th scope="col">Operation</th>
                        </tr>
                    </thead>
                    <tbody id="listProcess-${key}">${table}</tbody>
                    </table>
                </div>                
                `)
            }    
            cluster.init(document.getElementById('Health').getContext('2d'),json.workers)
            $('a#cluster-health-tab').click()     
            openNav()                       
        })
    })

    $('[data-toggle="tooltip"]').tooltip()

    $('#paper-tab a').on('click', function (e) {
        e.preventDefault()
        const tab = $(this).text()
        $(this).tab('show')
        if (tab === 'Graph') {
            $('div#graph').css({display :'block'})
            $('div#Code').css({display :'none'})     
            $('div#Cluster').css({display :'none'})        
        } else if(tab === 'Cluster') {
            $('div#graph').css({display :'none'})
            $('div#Code').css({display :'none'})     
            $('div#Cluster').css({display :'block'})     
        } else {
            $('div#Cluster').css({display :'none'}) 
            $('div#graph').css({display :'none'})
            $('div#Code').css({display :'block',
                width: $('div#paper-tabContent').width(),
                height: $('div#paper-tabContent').height()
            })
        }
        console.log(`Show paper tab: ${tab}`)
      })

    $('.CodeMirror').css({'font-size' : '18px'})
    lanchContextMenu("#paper")    

    $("input#projectinput").on("change", (e) => {
        const file = e.target.files[0];
        console.log(`Load Project File: ${file.name}, size: ${file.size}`)
        project.read(file,(result)=>{
            const proj = JSON.parse(result)
            console.debug(`Read Project: `,proj)
            proj.dafsm.forEach((fsm) => {                
                if (fsm.id !== 'bios') {
                    console.log(`Push ID: ${fsm.id}`)
                    pushLogicToStore($(`tbody#listLogics`),fsm.logic,fsm.id)
                }
            })
        })
    });

//    $('[data-toggle="popover"]').popover()
/*
    $('#paper-tab').on('click', '.close', function() {
        var tabID = $(this).parents('a').attr('href');
        uml.editor.set("",true);
        $('div#Code').appendTo('div.modal-content').css({display :'none'});
        $(this).parents('li').remove();
        $(tabID).remove();
        $('a#graph-svg-tab').tab('show');
    });    
    
    $('a[data-toggle="pill"]')
        .on('shown.bs.tab', function (e) {
            console.log('Show newly activated tab', e.target) // newly activated tab
            console.log('Show previous active tab', e.relatedTarget) // previous active tab
        })    
        .on('hidden.bs.tab', function (e) {
            console.log('Hide newly activated tab', e.target) // newly activated tab
            console.log('Hide previous active tab', e.relatedTarget) // previous active tab
        })    
*/             
});

function hideAll() {
    $('#dialog').css({display :'none'});
    $('#State').css({display :'none'});
    $('#Trans').css({display :'none'});
    $('#Code').css({display :'none'});
    $('#Inter').css({display :'none'});
    $('.event').prop('disabled', false);
//    $('.modal-content').css({height: 'auto',width: '40%'});
}

function newElem(elem) {
    $('#dialog').css({display :'block'});
    $('#'+elem).css({display :'block'});        
    if (elem === 'Code') {
        //$('.modal-content').css({height: '90%',width: '80%'});
        $('#dialog').css({display :'none'});
        $('a#code-edit-tab').tab('show');   
        $('div#graph').css({display :'none'})
        $('a#code-edit-tab').children('b').text('Editor')
        $('div#Code').css({display :'block',
            width: $('div#paper-tabContent').width(),
            height: $('div#paper-tabContent').height()
        })        
        uml.editor.set(uml.get());            
    } else {            
        updateStateList()
    }
}

function updateStateList() {
    
    $('select#fromState').find('option').remove().end();
    $('select#toState').find('option').remove().end();
    for (var s in uml.get().states) {
         console.log("Update state list",s);
         $("select#fromState").append($("<option></option>").val(s).html(s));
         $("select#toState").append($("<option></option>").val(s).html(s));
    }
}

function makeState() {
    let stateName = $('#stateName').val();
    let type = $('input:radio[name="stateType"]:checked').val(); 
           
    if (uml.get().states[stateName]) {
        $('#stateName')
            .val('')
            .attr('placeholder',"state[ "+stateName+"] exist - choose other name");
        console.log("state[ "+stateName+"] exist - choose other name");
        return;
    }            
    uml.makeState(type,stateName)
    //editor.set(uml.get())
    hideAll()
}

function makeTrans() { 
    let src = $('select#fromState').val();
    let dst = $('select#toState').val();

    if (!src || !dst) {
        $('#transName')
            .val('')
            .attr('placeholder',"please fill all fields and select side");
        console.log("please fill all fields and select side");
        return;
    } else if (src === dst) {
        $('select#toState')
            .val('')
//                .attr('placeholder',"selected src and dst is same state, please select one other and after change trans dst");
        console.log("selected src and dst is same state, please select one other and after change trans dst");
        return;            
    }
           
    uml.makeTrans(src,dst)
    //editor.set(uml.get())
    hideAll()
}

function openNav(bopen) {
    $('div.navigation').toggleClass("change");
    let mon  = $('div#monitor').get( 0 );
    let nav  = $('div#prjTemplate').get( 0 );
    let centre = $('main#paper').get( 0 );
    let papertab = $('ul#paper-tab').get( 0 );
    let papercontent = $('div#paper-tabContent').get( 0 );
//    console.log(nav.style.width);
    if ( nav.style.width == "0px") {
         nav.style.width = "29%";	
         nav.style.border = "2px solid black";         
         mon.style.width = "70%";
         centre.style.marginLeft = "-30%";
         papertab.style.marginLeft = "-25%";
         papercontent.style.width = "77%";
         papercontent.style.marginLeft = "23%";
    } else if(!bopen) {	  
         nav.style.width = "0px";	
         nav.style.border = "none";
         mon.style.width = "99.8%";
         centre.style.marginLeft = "0";
         papertab.style.marginLeft = "0";
         papercontent.style.width = "100%";
         papercontent.style.marginLeft = "0";
    }
}

function initJSONeditor(id) {
    // JSON Editor
    let container = document.getElementById(id);
    let options = {
        mode: 'view',
        modes: ['view', 'form', 'tree'], // allowed modes
        onError: function (err) {
            alert(err.toString());
        },
        onModeChange: function (newMode, oldMode) {
            console.log('Mode switched from', oldMode, 'to', newMode);
        }
    };
    /*
    let dafsm = {
        "id": "template",
        "type": "FSM",
        "prj": "proj_",
        "complete": false,
        "start": {},
        "stop": {},
        "countstates": 0,
        "states": {}
      };*/
    editor = new JSONEditor(container, options, initDafsmTemplate);  
    jtools = new jsonTools(editor);
    return editor 
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function showContextMenu(e) {
    var top = e.pageY - 10;
    var left = e.pageX - 90;
    $("#context-menu").css({
        display: "block",
        top: top,
        left: left
    }).addClass("show");    
    setTimeout(()=>{ $("#context-menu").removeClass("show").hide(); }, 5000)
}

function dropdownOnHover() {
    const $dropdown = $(".dropdown");
    const $dropdownToggle = $(".dropdown-toggle");
    const $dropdownMenu = $(".dropdown-menu");
    const showClass = "show";
     
//      if ($(window).matchMedia("(min-width: 768px)").matches) {
        $dropdown.hover(
          function() {
            const $this = $(this);
            $this.addClass(showClass);
            $this.find($dropdownToggle).attr("aria-expanded", "true");
            $this.find($dropdownMenu).addClass(showClass);
          },
          function() {
            const $this = $(this);
            $this.removeClass(showClass);
            $this.find($dropdownToggle).attr("aria-expanded", "false");
            $this.find($dropdownMenu).removeClass(showClass);
          }
        );
//      } else {
//        $dropdown.off("mouseenter mouseleave");
//      }    
}

function transTo() {
    const $dropdownToggle = $(".dropdown-toggle");
    const $dropdownMenu = $(".dropdown-menu");
    const showClass = "show";    

    $("#addTransTo").hover(
        function() {
          const $this = $(this);
          $this.addClass(showClass);
          $this.find($dropdownToggle).attr("aria-expanded", "true");
          $this.find($dropdownMenu).addClass(showClass);
        },
        function() {
          const $this = $(this);
          $this.removeClass(showClass);
          $this.find($dropdownToggle).attr("aria-expanded", "false");
          $this.find($dropdownMenu).removeClass(showClass);
        }
     ).mouseenter(function() {
        const $this = $(this);
        $this.addClass(showClass);
        $this.find($dropdownToggle).attr("aria-expanded", "true");
        $this.find($dropdownMenu).addClass(showClass);
    }).mouseleave(function() {
        const $this = $(this);
        $this.removeClass(showClass);
        $this.find($dropdownToggle).attr("aria-expanded", "false");
        $this.find($dropdownMenu).removeClass(showClass);
    })   
}
//----------------------------------------------------------------------//
window.metricSource = function(resource, parameter) {
    $('i#metricSource').text(` ${resource}::${parameter}`)
    cluster.updateMetrics(resource,parameter)
}

window.transFromTo = function(src,dst) {
    console.log(`make trans from ${src} to ${dst}`)
    uml.makeTrans(src,dst)
}

window.codeTemplate = function(funcname,code) {
    $(`div#body-${funcname}`).text(code)
    $(`div#card-${funcname}`).css({ 'background-color': 'lightpink' }) 
}

window.editCode = function(elem) {
    const cardHeader = $(elem).parent().siblings('div.card-header')
    const fname = cardHeader.children('h5').children('a').text();
    $('a#code-edit-tab').children('b').text(fname);
//    $('a#code-edit-tab').tab('show');  
    $('a#code-edit-tab').click(); 
    $('div#graph').css({display :'none'})
    $('div#Code').css({display :'block',
        width: $('div#paper-tabContent').width(),
        height: $('div#paper-tabContent').height()
    })
    uml.editor.set($(elem).text(),true);
}

window.addPaperTab = function(elem) {
    //const fname = $(elem).children('a').text();
    const cardHeader = $(elem).parent().siblings('div.card-header')
    cardHeader.css({ 'background-color': 'lightgray' })
    const fname = cardHeader.children('h5').children('a').text();
    console.log('Function name:', fname)
    const $newTab = $('a#'+fname+'-tab');

    if ($newTab.get( 0 )) {
        $newTab.tab('show')
    } else {
        $('ul#paper-tab')
            .prepend(`
            <li class="nav-item">
                <a class="nav-link" id="${fname}-tab" data-toggle="pill" href="#${fname}" role="tab" aria-controls="${fname}" aria-selected="true">
                ${fname}   <button class="close" type="button"><i class="fas fa-times"></i></button></a>
            </li>`);
        $(`
        <div class="tab-pane fade" id="${fname}" role="tabpanel" aria-labelledby="${fname}-tab" style="width: 100%;height: 100%;"></div>
        `).insertBefore( 'div#graph' );
        $('div#Code').appendTo(`div#${fname}`).css({display :'block',
            width: $('div#paper-tabContent').width(),
            height: $('div#paper-tabContent').height()
        })
        uml.editor.set($(elem).text(),true)
        $('a#'+fname+'-tab').tab('show')
    }
}

window.updateFuncBody = function(elem) {
    const code = uml.editor.get()
    $(elem).text(code)
}

window.attachFuncTo = function(name) {
    switch(name) {
        case 'start':
            uml.addstart(`fn_${name}`, uml.editor.get())
            break
        case 'stop':
            uml.addstop(`fn_${name}`, uml.editor.get())
            break
    }
    lstorage.set(JSON.stringify(uml.get()))
    uml.jsonedit.set(JSON.parse(lstorage.get()))
}

window.keepFuncJson = function(elem) {
    $(elem).children('a').attr('contenteditable',false)
//    $(elem).parent().css({ 'background-color': 'lightgreen' })
    const cardHeader = $(elem).parent('div.card-header')
    const funcName = $(elem).children('a').text()
    const funcCode = cardHeader.parent().find('.card-body').text()   
    const typeAction = $('a#add-action-tab').attr('title')
    console.log(`Type: [${typeAction}] (FuncName ${funcName}, FuncCode ${funcCode})`)

    uml.addAction(typeAction,funcName,funcCode)

    lstorage.set(JSON.stringify(uml.get()))
    uml.jsonedit.set(JSON.parse(lstorage.get()))
   
    updateAtomNote(cardHeader,typeAction)
}

window.updateJsonFuncBody = function(elem) {
    const cardHeader = $(elem).parent('div.card-header')
    const funcName = $(elem).children('a').text()
    const funcCode = cardHeader.parent().find('.card-body').text()    
    $(elem).children('a').attr('contenteditable',false)

    if (jtools.fnupdate(funcName.replace(/\s/g, ''),funcCode))
        $(elem).parent().css({ 'background-color': 'lightgreen' })      
}

window.newAction = function(elem) {
    const fname = prompt('Enter Atom Name', `fn_${Math.random().toString(20).substr(2, 6)}`)
    var count = parseInt($("div#codecollect").attr("count"))+1
    $("div#codecollect")
//    .append(`
    .prepend(`
    <div class="card" style="margin: 10px;">
    <div class="card-header" role="tab" id="card-${fname}" data-toggle="tooltip" data-placement="left"
    data-content="[]">
      <h5 class="mb-0" ondblclick="keepFuncJson(this)" style="display: flex;">
        <a data-toggle="collapse" href="#collapse${fname}" aria-expanded="true" aria-controls="collapscount" contenteditable="false">${fname}</a>
        <a class="nav-link" data-toggle="dropdown" href="#" role="button" aria-haspopup="true" aria-expanded="false" style="margin-left: auto;">
          <i class="fas fa-ellipsis-v fa-sm fa-fw text-gray-400"></i>
        </a>
        <div class="dropdown-menu">
            <a class="dropdown-item" href="#" onclick="codeTemplate('${fname}','return (new Promise((resolve,reject) => { setTimeout(() => resolve(cntx), 1000) })).then(data => { return true });')"><i class="fas fa-sync-alt"></i>   Async Body</a>
            <a class="dropdown-item" href="#" onclick="delAtomAction('card-${fname}')"><i class="fas fa-trash-alt"></i>   Delete</a>
        </div>
      </h5>
    </div>
    <div id="collapse${fname}" class="collapse show" role="tabpanel" aria-labelledby="${fname}">
      <div class="card-body" id="body-${fname}" onclick="editCode(this)"> console.debug(': Run ${fname}:'); return true; </div>
    </div>
    </div> `)
    .attr("count",`${count}`)
    .scrollTop(250);
    $('a#code-collect-tab').tab('show')
    $('a#code-edit-tab').click()
}

function showAtom(fname, func, verify) {
    const bcolor = verify ? 'lightgreen' : 'lightpink'
    const funcBodyOper = (verify === undefined) ? 'keepFuncJson(this)' : 'updateJsonFuncBody(this)'
    var count = parseInt($("div#codecollect").attr("count"))+1
    $("div#codecollect")
    .append(`
    <div class="card" style="margin: 10px;">
    <div class="card-header" role="tab" id="card-${fname}" data-toggle="tooltip" data-placement="top"
    data-content="[]" style="background-color: ${bcolor};">
      <h5 class="mb-0" ondblclick="${funcBodyOper}" style="display: flex;">
        <a data-toggle="collapse" href="#collapse${fname}" aria-expanded="true" aria-controls="collapscount" contenteditable="false">${fname}</a>
        <a class="nav-link" data-toggle="dropdown" href="#" role="button" aria-haspopup="true" aria-expanded="false" style="margin-left: auto;">
          <i class="fas fa-ellipsis-v fa-sm fa-fw text-gray-400"></i>
        </a>
        <div class="dropdown-menu">
            <a class="dropdown-item" href="#" onclick="codeTemplate('${fname}','return (new Promise((resolve,reject) => { setTimeout(() => resolve(cntx), 1000) })).then(data => { return true });')"><i class="fas fa-sync-alt"></i>   Async Body</a>
            <a class="dropdown-item" href="#" onclick="delAtomAction('card-${fname}')"><i class="fas fa-trash-alt"></i>   Delete</a>
        </div>
      </h5>
    </div>
    <div id="collapse${fname}" class="collapse" role="tabpanel" aria-labelledby="${fname}">
      <div class="card-body" id="body-${fname}" onclick="editCode(this)"> ${func} </div>
    </div>
    </div> `)
    .attr("count",`${count}`)
    biosStorage(fname,func)
}

function biosStorage(fname,fbody) {
    let   lstBios = {}
    const bios = sstorage.get('bios')
    if (bios) {
        lstBios = JSON.parse(bios)
    } 
    lstBios[fname] = fbody
    sstorage.set(JSON.stringify(lstBios),'bios')
}

window.delAtomAction = (elem)=> {
    $(`div#${elem}`).parent().remove()
}

window.showTab = (selector) => {
    $(selector).tab('show')
}

window.disConnect = (elem) => {
    $('input[aria-label="Target"]').prop( "disabled", false )
    $('input[aria-label="Port"]').prop( "disabled", false )
    $('span#targetStatus').css({'background-color': '#e9ecef'})
    $('a.target').addClass("disabled")    
    $("tbody#listLogics").empty()
}
// ---------------------- Cluster REST API operation --------------
/*
window.getConnect = (elem) => {
    const target = $('input[aria-label="Target"]').val()
    const port   = $('input[aria-label="Port"]').val()
    const reqConfig = {
        method  : 'get',
        service : 'version',
        params  : []
    }
    fetch(`/version`, {
        method: 'get',
        headers: {
            'Content-Type': 'application/json'
        }
    })  
        .then(res => res.json())
        .then(json => {             
            console.log(json)
            $('input[aria-label="Target"]').prop( "disabled", true )
            $('input[aria-label="Port"]').prop( "disabled", true )
            $('span#targetStatus').css({'background-color': '#28a745a6'})
            $('a.target').removeClass("disabled")
            getLogicsList()
        })
        .catch(console.error.bind(console));
}

window.getLogicsList = () => {
    const target = $('input[aria-label="Target"]').val()
    const port   = $('input[aria-label="Port"]').val()
    const reqConfig = {
        method  : 'get',
        service : 'logics',
        params  : []
    }
    const handle = (json) => {
        const table = $("tbody#listLogics")
        table.empty()
        json.forEach(function(item, i, arr) {
            table.append(`
            <tr id="${item}">
                <th scope="row">
                    <div class="form-check">
                        <input class="form-check-input position-static" type="radio" name="lstLogic" id="${item}" value="${i}" onclick="getLogicByName(this)">
                    </div>
                </th>
                <td>${item}</td>
                <td>
                    <button type="button" class="btn btn-info logicAction" onclick="" disabled><i class="fas fa-exclamation-triangle"></i></button>
                </td>
                <td id="work-${item}">
                    <button type="button" class="btn btn-primary logicAction" onclick="stepLogic('${item}')" disabled><i class="fas fa-step-forward"></i></button>
                    <button type="button" class="btn btn-danger logicAction" onclick="delLogic('${item}')" disabled><i class="fas fa-trash-alt"></i></button>
                </td>
            </tr>`)
        })        
    }
    fetch(`/logics`, {
        method: 'get',
        headers: {
            'Content-Type': 'application/json'
        }
    })  
        .then(res => res.json())
        .then(json => {             
            console.log(json)
            handle(json.responce) 
        })
        .catch(console.error.bind(console));
}

window.getLogicByName = (elem) => {
    const target = $('input[aria-label="Target"]').val()
    const port   = $('input[aria-label="Port"]').val()
    const reqConfig = {
        method  : 'get',
        service : 'logics',
        params  : [elem.id],
//        body    :
    }
    const handle = (json) => {
        $('a#graph-svg-tab').tab('show')  
        $('div#graph').css({display :'block'})
        $('div#Code').css({display :'none'})        
        uml.jsonedit.set(json.responce)
        uml.graph.clear()
        uml.restoreGraph(json.responce.states)       
        $('button.logicAction').prop( "disabled", true )  
        $(`td#work-${elem.id} > button.logicAction`).prop( "disabled", false )  
    }

    fetch(`/3rdparty/${target}:${port}`, {
        method: 'post',
        headers: {
            'Content-Type': 'application/json'
        },
        body:JSON.stringify(reqConfig)
    })  
        .then(res => res.json())
        .then(json => {             
            console.log(json)
            handle(json) 
        })
        .catch(console.error.bind(console)); 
}
*/


window.attachLogic = (worker) => {
    const logic = uml.jsonedit.get() //uml.get()
    cluster.request({        
        method  : 'post',
        service : 'attach',
        params  : [worker],
        body    : logic
    }, (json) => {
        if (json.fault > 0) {
            console.error(`Verification Fault! ${json.fault} atom's function not assigned yet`)
            $('a#code-collect-tab').tab('show')
            $("div#codecollect").empty();
            jtools.walk(json,(key,value)=> {
                if (typeof(value)=="object") {
                    if (value.hasOwnProperty("fname") && 
                        value.hasOwnProperty("verify")) {
                        if (!value.verify) {   
                            showAtom(value.fname,undefined,value.verify)
                        } else {
                            showAtom(value.fname,jtools.getFuncByKey(value.fname),value.verify)
                        }
                    }
                }                
            })                   
        } else {
            const table = $(`tbody#listProcess-${worker}`)    
            addRowtoTable(table,worker,logic.id)
        }
    })        
}

window.loadLogic = (sname,worker) => {
    cluster.request({        
        method  : 'get',
        service : 'logics',
        params  : [sname,worker]
    }, (json) => {
        $('a#graph-svg-tab').click()  
        uml.jsonedit.set(json)
        uml.graph.clear()
        uml.restoreGraph(json.states)   
        $('i#graphDiagram').text(` ${json.prj}${json.id}`)
        $("div#codecollect").empty();
        uml.printAtomsList(json.states,json.start,json.stop).forEach((atom) => showAtom(atom.name,atom.func,true))      
    })
}

window.activeLogic = (sname,worker) => {
    cluster.request({        
        method  : 'get',
        service : 'activate',
        params  : [sname,worker]
    }, (json) => {
       
    })
}

window.delLogic = (sname,worker) => {
    cluster.request({        
        method  : 'delete',
        service : 'logic',
        params  : [sname,worker]
    }, (json) => {
        $(`#logic-${worker}-${sname}`).remove()        
    })
}

window.stepLogic = (worker,mode,elem) => {
    cluster.request({        
        method  : 'get',
        service : 'exec',
        params  : ['dafsm',worker,mode,cluster.suidGet()]
    }, (json) => {
        if (mode !== 'step') {
            const iconmode = $(elem).children()
            if (iconmode.hasClass( "fa-play" )) {
                iconmode.removeClass("fa-play")
                iconmode.addClass("fa-stop")
            } else if (iconmode.hasClass( "fa-stop" )) {
                iconmode.removeClass("fa-stop")
                iconmode.addClass("fa-play")                
            }
        }
    })
}

window.selectLogicByName = (selector) => {
    $('button.logicAction').prop( "disabled", true )  
    $(selector).prop( "disabled", false )      
}

window.delLogicFromStore = (elem,lid) => {
    $(`tr#${elem}`).remove()        
    sstorage.remove(lid)
}

window.showLogicFromStore = (lid) => {
    const json = JSON.parse(sstorage.get(lid))
    $('a#graph-svg-tab').click()  
    uml.jsonedit.set(json)
    uml.graph.clear()
    uml.restoreGraph(json.states)   
    $('i#graphDiagram').text(` ${json.prj}${json.id}`)
    uml.printAtomsList(json.states,json.start,json.stop)
        .forEach((atom) => 
            showAtom(atom.name,
                (atom.func === undefined) ? undefined : atom.func,
                (atom.func === undefined) ? false : true)            
        ) 
}

function pushLogicToStore(table,logic,key) {
    const lid = key ? key : `${logic.prj}${logic.id}`
    const prj = key ? key : logic.prj
    const id  = key ? '' : logic.id

    const prjID = key ? `<td colspan="2">${key}</td>` : `<td>${logic.prj}</td><td>${logic.id}</td>`

    table.append(`
        <tr id="logic-${lid}">
            <th scope="row">
                <a class="nav-link" data-toggle="dropdown" href="#" role="button" aria-haspopup="true" aria-expanded="false">
                    <i class="fas fa-ellipsis-v fa-sm fa-fw text-gray-400"></i>
                </a>
                <div class="dropdown-menu">
                    <a class="dropdown-item" href="#" onclick="delLogicFromStore('logic-${lid}','${lid}')"><i class="fas fa-trash-alt"></i>   Delete</a>
                    <a class="dropdown-item" href="#" onclick="showLogicFromStore('${lid}')"><i class="far fa-eye"></i>   Show</a>
                </div>
            </th>
            ${prjID}
        </tr>`)
    sstorage.set(key ? logic : JSON.stringify(logic), lid)
}
// --------------------------------------------------
function addRowtoTable(table,worker,sname) {   
    table.append(`
    <tr id="logic-${worker}-${sname}">
    <th scope="row">
        <div class="form-check">
            <input class="form-check-input position-static" type="radio" name="selLogic" id="" value="" onclick="selectLogicByName('td#${worker}-${sname} > button.logicAction')">
        </div>
    </th>
    <td>${sname}</td>
    <td id="${worker}-${sname}">
        <button type="button" class="btn btn-success logicAction" onclick="loadLogic('${sname}','${worker}')" title="Load Logic" disabled><i class="fas fa-download"></i></button>
        <button type="button" class="btn btn-info logicAction" onclick="activeLogic('${sname}','${worker}')" title="Activate Logic" disabled><i class="fas fa-exclamation-triangle"></i></button>
        <button type="button" class="btn btn-primary logicAction" onclick="stepLogic('${worker}','step')" title="Run Step Logic" disabled><i class="fas fa-step-forward"></i></button>
        <button type="button" class="btn btn-warning logicAction" onclick="stepLogic('${worker}',1000,this)" title="Exec Loop Logic" disabled><i class="fas fa-play"></i></button>        
        <button type="button" class="btn btn-danger logicAction" onclick="delLogic('${sname}','${worker}')" title="Delete Logic" disabled><i class="fas fa-trash-alt"></i></button>
    </td>
</tr>`)    
}

function updateAtomNote(atomElem,typeAction) {
    let item = {}
    const select = uml.getSelectedItem()
    if (!select) return
    item[select.name] = typeAction
    let note = JSON.parse(atomElem.attr('data-content'))
    note.push(item)
    const participant = JSON.stringify(note)
    console.log(`Action Participant: ${participant}`)
    atomElem.attr({'data-content': participant,'title': participant})
            .css({ 'background-color': 'lightgreen' })
            .tooltip()
}

function dstStateList(src) {
    $('div#dstStateList').nextAll().remove()
    for (var s in uml.get().states) {
        console.log("Update state list",s);
        if (s !== src) {
            $( 'div#dstStateList' )
                .after( '<a class="dropdown-item state" href="#" onclick="transFromTo(`'+src+'`,`'+s+'`)">state ['+s+']</a>' ) 
        }
   }    
}

function lanchContextMenu(elemid) {
    $("div#graphContextMenu").clone()
        .appendTo(elemid)
        .attr("id","context-menu");
//    $("div#graphContextMenu").clone().appendTo("#ContextMenu").attr("id","context-menu");        
    $('.jumbotron')
      .on('contextmenu', function(e) {
        showContextMenu(e)
        const srcItem = uml.getSelectedItem() 
        if (srcItem && srcItem.type === 'state') 
            dstStateList(srcItem.name)
        return false; //blocks default Webbrowser right click menu
    }).on("click", function(e) {
        if (e.altKey || e.ctrlKey || e.shiftKey) {
            showContextMenu(e)
            const srcItem = uml.getSelectedItem() 
            if (srcItem && srcItem.type === 'state' && srcItem.name !== 'final') 
                dstStateList(srcItem.name)
        } else
            $("#context-menu").removeClass("show").hide();
    });

    $("#context-menu a").on("click", function() {
        $(this).parent().removeClass("show").hide();
    });

    $('.paper').css({display :'block'});
    $('.state').css({display :'none'}); 
    $('.trans').css({display :'none'}); 

    $('a#makeState').click(()=>{ newElem('State') })
    $('button#confirmState').click(()=>{ makeState() })
    $('a#makeTrans').click(()=>{ newElem('Trans') })
    $('button#confirmTrans').click(()=>{ makeTrans() })
    $('a#showLogic').click(()=>{ newElem('Code') })
    $('a#showAtoms').click(()=>{ 
        const json = uml.jsonedit.get(); 
        $("div#codecollect").empty(); 
        uml.printAtomsList(json.states,json.start,json.stop)
            .forEach((atom) => 
                showAtom(atom.name,
                    (atom.func === undefined) ? undefined : atom.func,
                    (atom.func === undefined) ? false : true)                
            ) 
    })
    $('a#pushLogic').click(()=>{ pushLogicToStore($(`tbody#listLogics`) ,uml.jsonedit.get()) })
    $('span#closeModal').click(()=>{ hideAll() })
    $('a#delState').click(()=>{ uml.sellRemove() })       
    $('a#addEntry').click(()=>{ openNav(true); $('a#add-action-tab').text('>[entries]'); $('a#add-action-tab').attr('title','entries'); $('a#code-collect-tab').tab('show') })
    $('a#addExit').click(()=>{ openNav(true); $('a#add-action-tab').text('>[exits]'); $('a#add-action-tab').attr('title','exits'); $('a#code-collect-tab').tab('show') })
    $('a#addStay').click(()=>{ openNav(true); $('a#add-action-tab').text('>[stays]'); $('a#add-action-tab').attr('title','stays'); $('a#code-collect-tab').tab('show') })

    $('a#addTrigger').click(()=>{ openNav(true); $('a#add-action-tab').text('>[triggers]'); $('a#add-action-tab').attr('title','triggers'); $('a#code-collect-tab').tab('show') })
    $('a#addEffect').click(()=>{ openNav(true); $('a#add-action-tab').text('>[effects]'); $('a#add-action-tab').attr('title','effects'); $('a#code-collect-tab').tab('show') })    
/*
    $('a#openDafsm').click(()=>{ 
        const restore = JSON.parse(lstorage.get())
        if (restore) {
            uml.jsonedit.set(restore)
            uml.restoreGraph(restore.states)   
            uml.printAtomsList(restore.states,restore.start,restore.stop).forEach((atom) => showAtom(atom.name,atom.func)) 
        }    
    })
    $('a#saveDafsm').click(()=>{ lstorage.set(JSON.stringify(uml.jsonedit.get())); })  
*/       
    /* 
        project = {
            target: {
                {dnsname|ipaddress}: '',
                secrets: {}
            },
            dafsm: [
               main: {...},
               .....
            ],
            monitor : {
                step: {
                    currState: currState,
                    nextState: nextState,
                    actionLst: [...]
                }    
            }
        }
    */  

    $('a#newGraph').click(()=>{ 
        uml.graph.clear(); 
        uml.jsonedit.set(initDafsmTemplate); 
        $('i#graphDiagram').text(` ${initDafsmTemplate.prj}${initDafsmTemplate.id}`)
        $("div#codecollect").empty(); 
    })
    $('a#openProj').click(()=>{ $('input#projectinput').click() })
    $('a#saveProj').click(()=>{ 
        const proj = {
            dafsm: sstorage.retrive((key,value)=>{ return {id: key, logic: value} })
        }
        /*
        proj.dafsm = Object.keys(sessionStorage).map((key) => {
            return {id: key, logic: sstorage.get(key)}
        })*/
        project.save(JSON.stringify(proj))  
     })     
}

function addAction(msg) {
    var dt = new Date()
    dt = dt.getHours() + ":" + dt.getMinutes() + ":" + dt.getSeconds()
    var count = parseInt($("#codecollect").attr("count"))+1
    $("#codecollect")
    .append(`
    <div class="card">
        <div class="card-header" role="tab" id="heading${count}">
        <h5 class="mb-0" ondblclick="step_animated('${msg.curr}',()=>{})" data-toggle="popover" data-placement="top"
        data-content="${msg.participant}">
            <a data-toggle="collapse" href="#collapse${count}" aria-expanded="true" aria-controls="collapse${count}">
            ${dt} | STEP-${count}: [${msg.curr.toString()}] => [${msg.next.toString()}]
            </a>
        </h5>
        </div>
        <div id="collapse${count}" class="collapse" role="tabpanel" aria-labelledby="heading${count}">
        <div class="card-body">
                    ${printlist(msg.step)}
        </div>
        </div>
    </div>`)
    .attr("count",`${count}`)
    .scrollTop(250);
    $('[data-toggle="popover"]').popover()    
}

function printlist(list) {
    var ret = ``
    jQuery.each( list, function( i, val ) {  
        if (Array.isArray(val)) {
            ret += printlist(val)
        } else {      
            if(i > 0) ret +=`<li>${val}</li>`
            else      ret += `<ul style="color:${val}">`
        }
      });        
    ret +=`</ul>`
    return ret
}