const express=require('express');
const exphbs=require('express-handlebars');
const mongoose=require('mongoose');
const bodyParser=require('body-parser');
const session=require('express-session');
const cookieParser=require('cookie-parser');
const passport=require('passport');
const bcrypt=require('bcryptjs');
const formidable=require('formidable');
const socketIO=require('socket.io');
const http=require('http');

/*mongoose.Types.ObjectId.isValid('id');*/
const port=process.env.PORT || 3000;
//INIT APP
const app=express();
//SETUP BODY-PARSER MIDDLEWARE
app.use(bodyParser.urlencoded({extended:false}));
app.use(bodyParser.json());
//SETUP AUTHENTICATION
app.use(cookieParser());
app.use(session({
    secret:'mysecret',
    resave: true,
    saveUninitialized: true,
}));
app.use(passport.initialize());
app.use(passport.session());
//LOAD HELPERS
const {requireLogin, ensureGuest}=require('./helpers/authHelper');
const {upload}=require('./helpers/aws');
//LOAD PASSPORTS
require('./passport/local');
require('./passport/facebook');
//MAKE USER AS GLOBAL OBJECT
app.use((req, res, next)=>{
    res.locals.user=req.user || null;
    next();
});
//LOAD FILES
const keys=require('./config/keys');
//LOAD STRIPE PAYMENTS MODULE
const stripe=require('stripe')(keys.StripeSecretKey);
//LOAD COLLECTIONS
const User=require('./models/user');
const Contact=require('./models/contact');
const Car=require('./models/car');
const Chat=require('./models/chat');
const Budjet=require('./models/budjet');
//const car = require('./models/car');

//CONNECT TO DATABASE(MongoDB)
try{
    mongoose.connect(keys.MongoDB, {
        useNewUrlParser:true
    }, ()=>{
        console.log('MongoDB connected!');
    });
}
catch(err){
    console.log(err);
}
app.engine('handlebars', exphbs({
    defaultLayout: 'main',
    runtimeOptions:{
        allowProtoPropertiesByDefault: true,
        allowProtoMethodsByDefault: true,
    }
}));
app.set('view engine', 'handlebars');
//CONNECT CLIENT SIDE TO SERVE CSS AND JS FILES
app.use(express.static('public'));
app.get('/',ensureGuest, (req, res)=>{
    res.render('home');
});
app.get('/about', ensureGuest, (req, res)=>{
    res.render('about',{
        title:'About Us',
    });
});
app.get('/contact', requireLogin, (req, res)=>{
    res.render('contact', {
        title:'Contact Us',
    });
});
//SAVE CONTACT FORM DATA
app.post('/contact', requireLogin, (req, res)=>{
    console.log(req.body);
    const newContact={
        name: req.user._id,
        message: req.body.message,
    };
    new Contact(newContact).save((err, user)=>{
        if(err){
            throw err;
        }
        else{
            console.log(`${user} contacted us`);
        }
    });
});
app.get('/signup', ensureGuest, (req, res)=>{
    res.render('signupForm', {
        title:'Register',
    });
});
app.post('/signup', ensureGuest, (req, res)=>{
    console.log(req.body);
    let errors=[];
    if(req.body.password!==req.body.password2){
        errors.push({text:'Password does not match'});
    }
    if(req.body.password.length<3){
        errors.push({text:'Password must be at least 3 characters'});
    }
    if(errors.length>0){
        res.render('signupForm', {
            errors: errors,
            firstname: req.body.firstname,
            lastname: req.body.lastname,
            password: req.body.password,
            password2: req.body.password2,
            email: req.body.email,
        });
    }
    else{
        User.findOne({email: req.body.email})
        .then((user)=>{
            if(user){
                let errors=[];
                errors.push({text:'Email already exists'});
                res.render('signupForm',{
                    errors: errors,
                    firstname: req.body.firstname,
                    lastname: req.body.lastname,
                    password: req.body.password,
                    password2: req.body.password2,
                    email: req.body.email,
                });
            }
            else{
                //ENCRYPT PASSWORD
                let salt=bcrypt.genSaltSync(10);
                let hash=bcrypt.hashSync(req.body.password, salt);
                const newUser={
                    firstname: req.body.firstname,
                    lastname: req.body.lastname,
                    email: req.body.email,
                    password: hash
                }
                new User(newUser).save((err, user)=>{
                    if(err){
                        throw err;
                    }
                    if(user){
                        let success=[];
                        success.push({text: 'Account successfully created. Please Login'});
                        res.render('loginForm', {
                            success: success,
                        });
                    }
                });
            }
        });
    }
});
app.get('/displayLoginForm', ensureGuest, (req, res)=>{
    res.render('loginForm', {
        title: 'Login',
    });
});
//PASSPORT AUTHENTICATION
app.post('/login', passport.authenticate('local', {
    successRedirect: '/profile',
    failureRedirect: '/loginErrors',
}));
app.get('/auth/facebook', passport.authenticate('facebook', {
    scope: ['email'],
}));
app.get('/auth/facebook/callback', passport.authenticate('facebook', {
    successRedirect: '/profile',
    failureRedirect: '/',
}));
//DISPLAY PROFILE
app.get('/profile', requireLogin, (req, res)=>{
    User.findById({_id:req.user._id})
    .then((user)=>{
        user.online= true,
        user.save((err, user)=>{
            if(err){
                throw err;
            }
            if(user){
                res.render('profile', {
                    user: user,
                    title:'Profile'
                });
            }
        });
    });
});
app.get('/loginErrors', (req, res)=>{
    let errors=[];
    errors.push({text:'User not found or Password incorrect.'});
    res.render('loginForm', {
        errors: errors,
        title: 'Error',
    });
});
//LIST CAR ROUTE
app.get('/listCar', requireLogin, (req, res)=>{
    res.render('listCar', {
        title: 'Listing',
    });
});
app.post('/listCar', requireLogin, (req, res)=>{
    const newCar={
        owner: req.user._id,
        make: req.body.make,
        model: req.body.model,
        year: req.body.year,
        type: req.body.type,
    };
    new Car(newCar).save((err, car)=>{
        if(err){
            throw err;
        }
        if(car){
            res.render('listCar2', {
                title: 'Finish',
                car: car,
            });
        }
    });
});
app.post('/listCar2', requireLogin, (req, res)=>{
    Car.findOne({
        _id: req.body.carID,
        owner: req.user._id,
    }).then((car)=>{
        let imageUrl={
            imageUrl: `https://car-rent-project.s3.ap-south-1.amazonaws.com/${req.body.image}`,
        };
        car.pricePerHour=req.body.pricePerHour;
        car.pricePerWeek=req.body.pricePerWeek;
        car.location=req.body.location;
        car.picture=`https://car-rent-project.s3.ap-south-1.amazonaws.com/${req.body.image}`;
        car.image.push(imageUrl);
        car.save((err, car)=>{
            if(err){
                throw err;
            }
            if(car){
                res.redirect('/showCars');
            }
        });
    });
});
app.get('/showCars', requireLogin, (req, res)=>{
    Car.find({})
    .populate('owner')
    .sort({date: 'desc'})
    .then((cars)=>{
        res.render('showCars', {
            cars: cars,
            title: 'Cars'
        });
    });
});
//RECEIVE IMAGE
app.post('/uploadImage', requireLogin, upload.any(), (req, res)=>{
    const form=new formidable.IncomingForm();
    form.on('file', (field, file)=>{
        console.log(file);
    });
    form.on('error', (err)=>{
        console.log(err);
    });
    form.on('end', ()=>{
        console.log('Image received successfully');
    });
    form.parse(req);
});
//LOGOUT ROUTE
app.get('/logout', requireLogin, (req, res)=>{
    User.findById({_id: req.user._id})
    .then((user)=>{
        user.online=false;
        user.save((err, user)=>{
            if(err){
                throw err;
            }
            if(user){
                req.logout();
                res.redirect('/');
            }
        });
    });
});
//GOOGLE MAP ROUTE
app.get('/openGoogleMap',requireLogin, (req, res)=>{
    res.render('googlemap', {
        title: 'Map'
    });
});
//DISPLAY ONE CAR INFO
app.get('/displayCar/:id', requireLogin, (req, res)=>{
    Car.findOne({_id: req.params.id}).then((car)=>{
        res.render('displayCar', {
            car: car,
            title: 'Car Information'
        });
    }).catch(err=>console.log(err));
});
//CONTACT OWNER ROUTE
app.get('/contactOwner/:id', requireLogin, (req, res)=>{
    User.findOne({_id: req.params.id})
    .then((owner)=>{
        res.render('ownerProfile', {
            owner: owner,
            title: 'Contact Owner'
        });
    }).catch(err=>console.log(err));
});
//RENT ROUTE
app.get('/rentCar/:id', requireLogin, (req, res)=>{
    Car.findOne({_id: req.params.id})
    .then((car)=>{
        res.render('calculate', {
            car: car,
            title: 'Cart',
        });
    }).catch(err=>console.log(err));
});
//CALCULATE TOTAL ROUTE
app.post('/calculateTotal/:id', requireLogin, (req, res)=>{
    Car.findOne({_id: req.params.id})
    .then((car)=>{
        console.log(req.body);
        var hour=parseInt(req.body.hour);
        var week=parseInt(req.body.week);
        var totalHours=hour*car.pricePerHour;
        var totalWeeks=week*car.pricePerWeek;
        var total= totalHours+totalWeeks;
        console.log(`Total is ${total}`);
        //CREATE A BUDJET
        const budjet={
            carID: req.params.id,
            total: total,
            renter: req.user._id,
            date: new Date(),
        };
        new Budjet(budjet).save((err, budjet)=>{
            if(err){
                console.log(err);
            }
            if(budjet){
                Car.findOne({_id: req.params.id})
                .then((car)=>{
                    //CALCULATE TOTAL FOR STRIPE
                    var stripeTotal=budjet.total*100;
                    res.render('checkout', {
                        budjet: budjet,
                        car: car,
                        StripePublishableKey: keys.StripePublishableKey,
                        stripeTotal: stripeTotal,
                        title: 'Checkout',
                    });
                }).catch(err=>console.log(err));
            }
        });
    });
});
//PAYMENT CHARGE ROUTE
app.post('/chargeRenter/:id', requireLogin, (req, res)=>{
    Budjet.findOne({_id: req.params.id})
    .populate('renter')
    .then((budjet)=>{
        const amount=budjet.total*100;
        stripe.customers.create({
            email: req.body.stripeEmail,
            source: req.body.stripeToken,
        }).then((customer)=>{
            stripe.charges.create({
                amount: amount,
                description: `Rs.${budjet.total} for renting.`,
                currency: 'inr',
                customer: customer.id,
                receipt_email: customer.email,
            }, (err, charge)=>{
                if(err){
                    console.log(err);
                }
                if(charge){
                    console.log(charge);
                    res.render('success', {
                        charge: charge,
                        budjet: budjet,
                    });
                }
            });
        }).catch(err=>console.log(err));
    }).catch(err=>console.log(err));
});
//SOCKET IO CONNECTION
const server=http.createServer(app);
const io=socketIO(server);
io.on('connection', (socket)=>{
    console.log('Socket IO connected to client...');
    //HANDLE CHATROOM ROUTE
    app.get('/chatOwner/:id', requireLogin, (req, res)=>{
        Chat.findOne({
            sender: req.params.id,
            receiver: req.user._id
        }).then((chat)=>{
            if(chat){
                chat.date=new Date();
                chat.senderRead=false;
                chat.receiverRead=true;
                chat.save().then((chat)=>{
                    res.redirect(`/chat/${chat._id}`);
                }).catch(err=>console.log(err));
            }
            else{
                Chat.findOne({
                    sender: req.user._id,
                    receiver: req.params.id,
                }).then((chat)=>{
                    if(chat){
                        chat.senderRead=true;
                        chat.receiverRead=false;
                        chat.date=new Date();
                        chat.save().then((chat)=>{
                            res.redirect(`/chat/${chat._id}`);
                        }).catch(err=>console.log(err));
                    }
                    else{
                        const newChat={
                            sender: req.user._id,
                            receiver: req.params.id,
                            date:new Date(),
                        };
                        new Chat(newChat).save().then((chat)=>{
                            res.redirect(`/chat/${chat._id}`);
                        }).catch(err=>console.log(err));
                    }
                }).catch(err=>console.log(err));
            }
        }).catch(err=>console.log(err));
    });
    //HANDLE /chat/id ROUTE
    app.get('/chat/:id', requireLogin, (req, res)=>{
        Chat.findOne({_id: req.params.id})
        .populate('sender')
        .populate('receiver')
        .populate('dialogue.sender')
        .populate('dialogue.receiver')
        .then((chat)=>{
            res.render('chatRoom', {
                chat: chat,
            })
        }).catch(err=>console.log(err));
    });
    //POST REQUEST TO /chat/ID
    app.post('/chat/:id', requireLogin, (req, res)=>{
        Chat.findById({_id: req.params.id})
        .populate('sender')
        .populate('receiver')
        .populate('dialogue.sender')
        .populate('dialogue.receiver')
        .then((chat)=>{
            const newDialogue={
                sender: req.user._id,
                date: new Date(),
                senderMessage: req.body.message,
            };
            chat.dialogue.push(newDialogue);
            chat.save((err, chat)=>{
                if(err){
                    console.log(err);
                }
                if(chat){
                    Chat.findOne({_id: chat._id})
                    .populate('sender')
                    .populate('receiver')
                    .populate('dialogue.sender')
                    .populate('dialogue.receiver')
                    .then((chat)=>{
                        res.render('chatRoom', {
                            chat: chat,
                        })
                    }).catch(err=>console.log(err));
                }
            });
        }).catch(err=>console.log(err));
    });
    //LISTEN TO OBJECT ID EVENT
    socket.on('ObjectID', (oneCar)=>{
        console.log(`One Car is ${oneCar}`);
        Car.findOne({
            owner: oneCar.userID,
            _id: oneCar.carID,
        })
        .then((car)=>{
            socket.emit('car', car);
        });
    });
    //FIND CARS AND SEND THEM TO BROWSER FOR MAP
    Car.find({}).then((cars)=>{
        socket.emit('allcars', {
            cars: cars,
        });
    }).catch((err)=>console.log(err));
    //LISTEN TO LATITUDE AND LONGITUDE EVENT
    socket.on('LatLng', (data)=>{
        console.log(data);
        //FIND CAR OBJECT AND UPDATE LAT LONG
        Car.findOne({
            owner: data.car.owner,
        }).then((car)=>{
            car.coords.lat= data.data.results[0].geometry.location.lat;
            car.coords.lng= data.data.results[0].geometry.location.lng;
            car.save((err, car)=>{
                if(err){
                    throw err;
                }
                if(car){
                    console.log('Car latitude and longitude is updated');
                }
            });
        }).catch((err)=>{
            console.log(err);
        });
    });
    //LISTEN TO DISCONNECT EVENT
    socket.on('disconnect', (socket)=>{
        console.log('Disconnected from client...');
    });
});

server.listen(port, ()=>{
    console.log(`Listening on port ${port}...`);
});