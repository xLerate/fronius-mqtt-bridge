var fronius = require('node-fronius-solar'),
    merge = require('merge-deep'),
    util = require('util'),
    mqtt = require('mqtt');

var options = {
        host: '192.168.2.156',
        port: 80,
        deviceId: 1,
        version: 1
};

var client  = mqtt.connect('mqtt://databox2:1883');


client.on("connect",function(){
    console.log("connected to mqtt-broker "+ client.connected);
})

//handle errors
client.on("error",function(error){
    console.log("can not connect or connection broken: " + error);
    process.exit(1)
});


function getData(json, x) {
    json = json.reduce((j1, j2 ) => merge(j1, j2));

    // generically push real-time data to mqtt-broker
    for (var key in json.Body.Data) {
        var obj =  json.Body.Data[key];
        if (typeof obj.Value === "number") {
            if (client.connected) {
                client.publish('fronius/realtime/' + key, obj.Value.toString());
            }
        }
    }

    // calculating power for MPPT1 and MPPT2
    var p1 = (json.Body.Data.UDC.Value * json.Body.Data.IDC.Value).toString();
    var p2 = (json.Body.Data.UDC_2.Value * json.Body.Data.IDC_2.Value).toString()
    client.publish('fronius/realtime/PDC' , p1);
    client.publish('fronius/realtime/PDC_2' , p2);

    // extract power-flow data and push to mqtt-broker
    for (var key in json.Body.Data.Site) {
        var obj =  json.Body.Data.Site[key];
        if (client.connected) {
            if (obj != null) {
                client.publish('fronius/powerflow/' + key, obj.toString());
            }
        }
    }

    // extract inverter-infos and push to mqtt-broker
    for (var key in json.Body.Data.Inverters[options.deviceId]) {
        var obj =  json.Body.Data.Inverters[options.deviceId][key];
        if (client.connected) {
            if (obj != null) {
                client.publish('fronius/inverter/' + options.deviceId + '/' + key, obj.toString());
            }
        }
    }

    if (client.connected) {
        client.publish('fronius/inverter/' + options.deviceId + '/status', json.Body.Data.DeviceStatus.InverterState);
    }
    //console.log(util.inspect(json, { depth: 5, colors : true }));
    //console.log(Date.now() - x, "milliseconds elapsed");
}

setInterval(function() {
    var x = Date.now();
    Promise.all([
        fronius.GetInverterRealtimeData(options),
        fronius.GetPowerFlowRealtimeDataData(options)
    ]).then(json => {
        getData(json, x);
    }).catch(reason => {
        console.error("error requesting data from inverter:", reason);
    });
}, 5000);
