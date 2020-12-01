//HANDLING CLIENT-SIDE SOCKET CONNECTION
$(document).ready(function(){
    //AUTO-SCROLL FOR CHATROOM
    $('#list').animate({
        scrollTop: 1000,
    }, 800);
    var socket=io();
    //CONNECT CLIENT TO SERVER
    socket.on('connect', function(socket){
        console.log('Client connected to server...');
    });
    //EMIT LOGGED IN USER ID
    var ObjectID=$('#ObjectID').val();
    var carID=$('#carID').val();
    socket.emit('ObjectID', {
        carID: carID,
        userID: ObjectID,
    });
    //LISTEN TO CAR EVENT
    socket.on('car', function(car){
        console.log(car);
        //AJAX REQUEST TO FETCH LATITUDE AND LONGITUDE
        $.ajax({
            url: `https://maps.googleapis.com/maps/api/geocode/json?address=${car.location}&key=AIzaSyAyU8j2UKMZr204KptHp5gulsmoqfZF9kA`,
            type: 'POST',
            data: JSON,
            processData: true,
            success: function(data){
                console.log(data);
                //SEND LAT AND LONG TO SERVER
                socket.emit('LatLng', {
                    data: data,
                    car: car,
                });
            }
        });
    });
    
    //DISCONNECT FROM SERVER
    socket.on('disconnect', function(){
        console.log('Disconnected from server...');
    });
});