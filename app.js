const express=require('express');
const exphbs=require('express-handlebars');
const app=express();
const port=3000;
//LOAD FILES
const keys=require('./config/keys');
app.engine('handlebars', exphbs({
    defaultLayout: 'main',
}));
app.set('view engine', 'handlebars');

//CONNECT CLIENT SIDE TO SERVE CSS AND JS FILES
app.use(express.static('public'));

app.get('/', (req, res)=>{
    res.render('home');
});
app.get('/about', (req, res)=>{
    res.render('about',{
        title:'About'
    });
});
app.get('/contact', (req, res)=>{
    res.render('contact', {
        title:'COntact Us',
    });
});
app.get('/signup', (req, res)=>{
    res.render('signupform', {
        title:'Register',
    });
});

app.listen(port, ()=>{
    console.log(`Listening on port ${port}...`);
});