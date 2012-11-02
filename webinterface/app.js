$(function(){
  var mqttSocket = new Mosquitto();


  Backbone.View.prototype.close = function(){
    this.remove();
    this.unbind();
    if (this.onClose){ // Provide custom functionality to remove event bindings in subclasses
      this.onClose();
    }
  }


  /*
   *
   *  MODELS
   *
   */

  var Control = Backbone.Model.extend({
    defaults: function() {
      return {
        value: null,
        type: null              
      };
    },

    initialize: function() {
    },
  });

  var Device = Backbone.Model.extend({
    defaults: function() {
      return {
        room: "unassigned",
        name: ""
      };
    },

    initialize: function() {
      this.controls = new ControlCollection;
    },
  });


  var Room = Backbone.Model.extend({
    initialize: function() {
      this.devices = new DeviceCollection;
    },
  });


  var DeviceCollection = Backbone.Collection.extend({
    model: Device,
  });

  var RoomCollection = Backbone.Collection.extend({
    model: Room,
  });

  var ControlCollection = Backbone.Collection.extend({
    model: Control,
  });

  /*
   *
   *  VIEWS
   *
   */

  var RoomListView = Backbone.View.extend({
    idName: "room-list", 
    tagName: "div",
    template: $("#room-list-template").html(),

    initialize: function() {
        this.model.on('add', this.addRoom, this);
      this.model.on('remove', this.addRoom, this);
              _.bindAll(this, 'addRoom', 'render');

    },

    addRoom: function(room) {
      console.log("Room added: " + room.get("id"));
      var detailViewLink = new RoomDetailLinkView({model: room});
      this.$('#room-detail-links').append(detailViewLink.render().$el);
    },

    render: function () {
        var tmpl = _.template(this.template);
        this.$el.html(tmpl());

        // According to http://jsperf.com/backbone-js-collection-iteration for iteration with collection.models is pretty fast
        for (var i = 0, l = this.model.length; i < l; i++) {
            this.addRoom(this.model.models[i]);
        }

        return this;
    },
    removeRoom: function(room) {
       room.detailViewLink.close();
    },


  });

   var RoomDetailLinkView = Backbone.View.extend({
    className: "room-detail-link", 
    tagName: "li",
    template: $("#room-detail-link-template").html(),

    initialize: function() {
      this.model.detailViewLink = this; 
    },

    render: function () {
        var tmpl = _.template(this.template);
        this.$el.html(tmpl(this.model.toJSON()));
        return this;
    },
   });


  var RoomDetailViewPlaceholder = Backbone.View.extend({
    template: $("#room-detail-placeholder-template").html(),
    className: "room", 

    initialize: function() {
      this.model.on('add', this.addRoom, this);
    },

    render: function () {
        var tmpl = _.template(this.template);
          this.$el.html(tmpl({id: this.id}));
        return this;
    },

    addRoom: function(room) {
      if(room.get("id") == this.id) {
        Router.room(this.id);
      }
    },
  });



  var RoomDetailView = Backbone.View.extend({
    template: $("#room-detail-template").html(),
    className: "room", 

    initialize: function() {
      this.model.devices.on('add', this.addDevice, this);
      this.model.devices.on('remove', this.removeDevice, this);

      this.model.bind('remove', this.remove, this);
      this.model.view = this;
    },

    // render: function() {

    render: function () {
        var tmpl = _.template(this.template);
        this.$el.html(tmpl(this.model.toJSON()));
        for (var i = 0, l = this.model.devices.length; i < l; i++) {
            this.addDevice(this.model.devices.models[i]);
        }

        return this;
    },

    addDevice: function(device) {

      var deviceView = new DeviceView({model: device});
      this.$(".devices").append(deviceView.render().el);
    },

    removeDevice: function(device) {
      console.log("removing device from room: "+ device.get('id') + " " + this.model.get('id'))
      console.log()
      $(device.view.el).unbind();
      $(device.view.el).remove();

      if (this.model.devices.length == 0) {
        console.log("Room is empty, removing it");
        Rooms.remove(this.model);
      }
    },


  });


  var ControlView = Backbone.View.extend({
    className: "control", 

    initialize: function() {
      this.model.on('change', this.render, this);
      this.model.view = this;
    },

    render: function() {
      this.$el.html(this.model.get('id')+":"+this.model.get('value'));
      return this;
    },

  });

  var DeviceView = Backbone.View.extend({
    template: $("#device-template").html(),
    className: "device", 

    initialize: function() {
      console.log("new DeviceView created for: " + this.model.id);
      this.model.on('change', this.render, this);
      this.model.on('destroy', this.remove, this);
      this.model.controls.on('add', this.addControl, this);

      this.model.view = this;
    },  

    render: function() {
      var tmpl = _.template(this.template);
      this.$el.html(tmpl(this.model.toJSON()));
      return this;
    },

    addControl: function(control) {
      var controlView = new ControlView({model: control});
      this.$(".controls").append(controlView.render().el);
    },
  });



  // Manages view transition 
  var AppView = Backbone.View.extend({
    el: $("#container"),

    showView: function(view) {
      if (this.currentView){
        this.currentView.close();
      }

      this.currentView = view;
      this.currentView.render();

      this.$el.html(this.currentView.$el);
    }

  });


  /*
   *
   *  BASE APPLICATION LOGIC & MQTT EVENT HANDLING
   *
   */

  var ApplicationRouter = Backbone.Router.extend({
  routes: {
    "rooms/:room": "room",
    "": "index",
    "/": "index",
  },
  initialize: function() {console.log("Router inizalized");},

  index: function() {
    console.log("showing roomListView");

    var roomListView = new RoomListView({model: Rooms});
    App.showView(roomListView);
  },


  room: function(id) {
    console.log("showing roomDetailView for room: " + id);
    var room = Rooms.get(id); // Room might not yet exists
    if (room == null) {
      // render "room not yet available. wait or go back to room list" view
      var roomDetailViewPlaceholder = new RoomDetailViewPlaceholder({model: Rooms, id: id});
      App.showView(roomDetailViewPlaceholder);
    } else {
      var roomDetailView = new RoomDetailView({model: room});
      App.showView(roomDetailView);
    }
   },





});



  mqttSocket.onconnect = function(rc){
    console.log("Connection established");
    mqttSocket.subscribe('/devices/#', 0);
  };

  mqttSocket.ondisconnect = function(rc){ 
    console.log("Connection terminated");
  };

  mqttSocket.onmessage = function(topic, payload, qos){

    console.log("-----------RECEIVED-----------");
    console.log("Received: "+topic+":"+payload);    

    var splitTopic = topic.split("/");

    // Ensure the device for the exists
    var deviceId = splitTopic[2]
    var device = Devices.get(deviceId);
    if (device == null) {
      device = new Device({id: deviceId});
      Devices.add(device);


        var room = Rooms.get(device.get('room'));
        if (room == null) {
          room = new Room({id: device.get('room')});     
          Rooms.add(room);   
        } 
        room.devices.add(device);
    }

    // Topic parsing
    if(splitTopic[3] == "controls") {
      var controlName = splitTopic[4];  
      var control = device.controls.get(controlName);
      if (control == null) {
        control = new Control({id: controlName});
        device.controls.add(control);
      }

      if(splitTopic[5] == null) {                                       // Control value
        console.log("Control value for "+ controlName+ " : " + payload);
        control.set("value", payload);
      } else {                                                          // Control type 
        console.log("Control type for "+ controlName+ " : " + payload);
        control.set("type", payload);
      } 
    } else if(splitTopic[3] == "meta" ) { 
      if (splitTopic[4] == "room") {                                    // Device Room
        var room = Rooms.get(device.get('room'));       
        if (room.get('id') != payload) {
          var newRoom = Rooms.get(payload);
          if (newRoom == null) {
            device.set('room', payload);
            newRoom = new Room({id: payload});  
            Rooms.add(newRoom);   
          } 
          room.devices.remove(device);
          newRoom.devices.add(device);
        }
      } else if(splitTopic[4] == "name") {                              // Device name
        device.set('name', payload);
      }
      device.set(splitTopic[4], payload);
    }
    console.log("-----------/ RECEIVED-----------");
  };


  var Devices = new DeviceCollection;
  var Rooms = new RoomCollection;
  var App = new AppView;

  var Router = new ApplicationRouter;
  Backbone.history.start({pushState : false});

  mqttSocket.connect("ws://192.168.8.2/mqtt");

});