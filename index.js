const express = require('express')
const path = require("path");
const cors = require("cors");
const { Client } = require('pg')

const app = express()

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
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
    email varchar,
    firstName varchar,
    lastName varchar,
    age int
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
// client
//     .query(query)
//     .then(res => {
//         console.log('Table is successfully created');
//     })
//     .catch(err => {
//         console.error(err);
//     })
//     .finally(() => {
//         client.end();
//     });

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
client.query(query4, (err, res) => {
    if (err) {
        console.error(err);
        return;
    }
    for (let row of res.rows) {
        console.log(row);
    }
    client.end();
});

//dropping a table
// client.query(q,(err,res)=>{
//     if(err) throw err
//     console.log(res)
// })


app.get('/',(req,res)=>{
    res.render('html/index')
})

const PORT = process.env.PORT || 3000

app.listen(PORT,()=>{
    console.log(`Server started at port ${PORT}`)
})