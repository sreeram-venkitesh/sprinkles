const express = require('express')
const path = require("path");
const cors = require("cors");
const { Client } = require('pg')
const { pool } = require('./dbConfig')


const app = express()

app.use(cors());
app.use(express.json())
app.use(express.urlencoded({ extended: false }))


app.use(express.static(__dirname + '/views'))
app.set('view engine', 'ejs')

const client = new Client({
    user: 'sreeram',
    host: 'localhost',
    database: 'sprinkles',
    password: '12345',
    port: 5432,
});

client.connect();

const query = `
CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL,
    password VARCHAR(200) NOT NULL,
    UNIQUE(email)
);
`;

const query3 = `
INSERT INTO users (email, firstName, lastName, age)
VALUES ('sreeram@gmail.com', 'sreeram', 'venkitesh', 21)
`;

const query4 = `
SELECT *
FROM users
`;


const q = `DROP TABLE users`

//creating table
client
    .query(query)
    .then(res => {
        console.log('Table is successfully created');
    })
    .catch(err => {
        console.error(err);
    })
    .finally(() => {
        client.end();
    });

//inserting rows
// client.query(query3, (err, res) => {
//     if (err) {
//         console.error(err);
//         return;
//     }
//     console.log('Data insert successful');
//     client.end();
// });

// displaying all rows
// client.query(query4, (err, res) => {
//     if (err) {
//         console.error(err);
//         return;
//     }
//     for (let row of res.rows) {
//         console.log(row);
//     }
//     client.end();
// });

//dropping a table
// client.query(q,(err,res)=>{
//     if(err) throw err
//     console.log(res)
// })


app.get('/',(req,res)=>{
    res.render('html/index')
})

app.get('/signup',(req,res)=>{
    res.render('html/signup')
})

app.get('/dashboard',(req,res)=>{
    res.render('html/dashboard',{ user: "Sreeram"})
})

app.post('/signup',(req,res)=>{
    let { name, email, password, password2 } = req.body;

    console.log({
        name,
        email,
        password,
        password2
    })

    let errors = []

    if(!name || !email || !password || !password2){
        errors.push({message: "Please enter all fields"})
    }
    if(password.length < 6 ){
        errors.push({message: "Password should atleast be 6 characters long"})
    }
    if(password != password2){
        errors.push({message: "Passwords do not match"})
    }

    if(errors.length > 0){
        res.render('html/signup',{ errors })
    }else{
        // Form validation passed
        
    }
})

const PORT = process.env.PORT || 3000

app.listen(PORT,()=>{
    console.log(`Server started at port ${PORT}`)
})