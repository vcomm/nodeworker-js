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
    }

    init(ctx,workers) {
        let datasets = []
        const timeFormat = 'MM/DD/YYYY HH:mm'
        const color = Chart.helpers.color;
        /*
        for (let [key, worker, set] of Object.entries(workers)) {
            set = {
                label: `Worker(${key})[#${worker.pid}]`,
                backgroundColor: color(worker.color).alpha(0.5).rgbString(),
                borderColor: worker.color,
                fill: false,
                data: [Math.round(Math.floor(Math.random() * 100))],                
            }
            datasets.push(set)
        }
        */
        this.config = {
			type: 'line',
			data: {
				labels: [
                    this.newDate(0),
//                    this.newDate(1),
//                    this.newDate(2),
                ],
				datasets: [/*{
					label: 'My First dataset',
					backgroundColor: color('#f46b6d').alpha(0.5).rgbString(),
					borderColor: '#f46b6d',
					fill: false,
					data: [
						Math.round(Math.floor(Math.random() * 100)),
						Math.round(Math.floor(Math.random() * 100)),
						Math.round(Math.floor(Math.random() * 100))
					],
				}, {
					label: 'My Second dataset',
					backgroundColor: color('#80c5e2').alpha(0.5).rgbString(),
					borderColor: '#80c5e2',
					fill: false,
					data: [
						Math.round(Math.floor(Math.random() * 100)),
						Math.round(Math.floor(Math.random() * 100)),
						Math.round(Math.floor(Math.random() * 100))
					],
				}*/]
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
//                data: [worker.resources.metrics[worker.resources.metrics.length-1].cpu.user]
                data: [Math.round(Math.floor(Math.random() * 10000))],                
            }
            this.config.data.datasets.push(set)
        }        
        this.chart = new Chart(ctx, this.config)
        setInterval(()=>{ 
            this.config.data.labels.push(this.newDate(this.config.data.labels.length));
//            this.chart.update()
        },50000)
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

    updateMetrics(metric,id) {
        if (this.config.data.datasets.length > 0 &&
            id < this.config.data.datasets.length) {
            this.config.data.datasets[id-1].data.push(metric.cpu.user)    
            console.log(`Update ${id}`,metric)
        }        
    }

    chartUpdate(metrics,id) {
//        const interval = 60000; // 60 sec

        if (this.config.data.datasets.length > 0) {

            if (this.metrics.count < this.config.data.datasets.length) {
                console.log(`Update metric ${id}`,metrics)
                this.metrics[id] = metrics
                this.metrics.count++
                if (this.metrics.count >= this.config.data.datasets.length-1) {
                    this.metrics.count = 0
//                    this.config.data.labels.push(this.newDate(this.config.data.labels.length));
                    for (let [id, metric] of Object.entries(this.metrics)) {
                        if (id !== 'count')
                            this.config.data.datasets[id-1].data.push(metric.cpu.user)
                    }
                    console.log(`Update chart`)
                    this.chart.update()  
                }               
            }

/*
                if (!this.increaseTime) {
                    this.increaseTime = true 
                    setTimeout(()=>{ this.increaseTime = false },interval)
                    this.config.data.labels.push(this.newDate(this.config.data.labels.length));
                }

            for (let index = 0; index < this.config.data.datasets.length; ++index) {
                if (typeof this.config.data.datasets[index].data[0] === 'object') {
                    this.config.data.datasets[index].data.push({
                        x: this.newDate(this.config.data.datasets[index].data.length),
                        y: Math.round(Math.floor(Math.random() * 100)),
                    });
                } else {
                    console.log(`Update ${id}`,metrics)
                    this.config.data.datasets[index].data.push(metrics.cpu.user)
//                    this.config.data.datasets[index].data.push(Math.round(Math.floor(Math.random() * 100)));
                }
            } 
            this.chart.update() 
*/            
          
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
              self.chartUpdate(data.metrics,data.worker);
              //self.updateMetrics(data.metrics,data.worker)
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
/* 
    const config = {
        url     : `http://target:port`,
        method  : 'post',
        service : 'attach',
        params  : ['dafsm'],
        body    : JSON
    }
*/   
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