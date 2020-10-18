'use strict';

import Chart from 'chart.js';
import moment from 'moment';

export default class nodeTarget {

    constructor(url) {
        this._url_ = url
        this._suid_ = NaN
        this.metrics = { count: 0 }
        this.monitorStatus = false
        this.increaseTime  = false
        this.show = {
            resource : 'cpu',
            parameter: 'user'
        }
    }

    init(ctx,workers) {
        const timeFormat = 'MM/DD/YYYY HH:mm'
        const color = Chart.helpers.color;
        this.config = {
			type: 'line',
			data: {
				labels: [],
				datasets: []
			},
			options: {
				title: {
					text: 'Cluster Health'
				},
				scales: {
					xAxes: [{
						type: 'time',
						time: {
							parser: timeFormat,
							// round: 'day'
							tooltipFormat: 'll HH:mm'
						},
						scaleLabel: {
							display: true,
							labelString: 'Date'
						}
					}],
					yAxes: [{
						scaleLabel: {
							display: true,
							labelString: 'value'
						}
					}]
				},
            }
        }
        for (let [key, worker, set] of Object.entries(workers)) {
            set = {
                label: `Worker(${key})[#${worker.pid}]`,
                backgroundColor: color(worker.color).alpha(0.5).rgbString(),
                borderColor: worker.color,
                fill: false,
            }
            this.config.data.datasets.push(set)
        }        
        this.chart = new Chart(ctx, this.config)
    }

    newDate(min) {
        return moment().add(min, 'minutes').toDate();
    }

    timeStamp(ts) {
        const dataObj = new Date(ts);
        let hours = dataObj.getHours();
        let minutes = dataObj.getMinutes();   
        let seconds = dataObj.getSeconds();  
        return `${hours}:${minutes}"${seconds}`   
    }

    updateMetrics(resource,parameter) {
        this.show.resource  = resource
        this.show.parameter = parameter
        this.chart.clear()       
        this.config.data.labels.length = 0
        for (let i = 0; i < this.config.data.datasets.length; i++) {
             this.config.data.datasets[i].data.length = 0
        }
    }

    updateChart(metrics,id) {
        if (this.config.data.datasets.length > 0) {
            console.log(`Update worker ${id}, type metric.${this.show.resource}.${this.show.parameter} = ${metrics[this.show.resource][this.show.parameter]}`,metrics)
            this.config.data.datasets[id-1].data.push({
                x: metrics.time,
                y: metrics[this.show.resource][this.show.parameter]
            })
            this.chart.update()
        }    
    }

    suidGet() { return this._suid_ }

    subscribe(handle) {
        this.request({        
            method  : 'get',
            service : 'version',
            params  : []
        },resp => {
            this._suid_ = resp.suid
            handle(resp)
        })
    }

    monitor(init,monitor,health) {
        const self = this
        if (!window.EventSource) {
          console.log("Your browser not supported EventSource.");
          return;
        }  
        var source = new EventSource("/subscribe/"+this._suid_);
        source.onopen = function(e) {
          console.log("Event: open: ",e);
        };   
        source.onmessage = function(e) {
          console.log("Event: message, data: ",e.data);
          
          const data = JSON.parse(e.data)
          if (!data) return;        
          if (!self.monitorStatus && data.hasOwnProperty('subscribe')) {
              init(`Monitoring Subscribe ID: ${data.subscribe}`);
              self.monitorStatus = true;
          } else if (data.hasOwnProperty('execute')) {  
              monitor(data.execute,data.process);       
          } else if (data.hasOwnProperty('metrics')) {
              health(data.metrics,data.worker); 
              self.updateChart(data.metrics,data.worker)
          }      
        };                    
        source.onerror = function(e) {
          console.log("Event: error - ",e);
          if (this.readyState == EventSource.CONNECTING) {
              console.log(`Reconnection (readyState=${this.readyState})...`);
          } else {
              console.log("Reconnection error");
          }
        };   
        return source
    }    

    request(config,handle) {   
        const init = (config.method === 'post') ? {
            method: config.method,
            headers: {
                'Content-Type': 'application/json'
            }
           ,body: JSON.stringify(config.body)
        } : {
            method: config.method,
            headers: {
                'Content-Type': 'application/json'
            }
        }     

        fetch(`/${config.service}/${config.params.join('/')}`, init)  
            .then(res => res.json())
            .then(json => {             
                console.log(json)
                handle(json.responce) 
            })
            .catch(console.error.bind(console));        
    }
}