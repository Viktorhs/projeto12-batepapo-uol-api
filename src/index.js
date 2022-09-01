import express from "express";
import cors from "cors";
import { MongoClient } from "mongodb";
import dotenv from "dotenv";
import dayjs from "dayjs"

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const mongoClient = new MongoClient(process.env.MONGO_URI);
let db;
mongoClient.connect().then(() => {
    db = mongoClient.db('test');
});

app.post("/participants", async (req, res) => {
    const {name} = req.headers;

    if(!name || name.length === 0){
        return res.sendStatus(422);
    }

    try {
        console.log(process.env.MONGO_URI)
        const participants = await db.collection('participants').findOne({name});
        if(!!participants){
            return res.sendStatus(409)
        }

        console.log('esperando o primeiro waint')

        await db.collection('participants').insertOne({name, lastStatus: Date.now()});
        const userLogin = {
            from: name, 
            to: 'Todos', 
            text: 'entra na sala...', 
            type: 'status', 
            time: dayjs().format("HH:mm:ss")
        }
        await db.collection('messages').insertOne(userLogin)
        console.log('acabou')
        res.sendStatus(201)
    } catch (error) {
        res.sendStatus(500)
    }
})

app.get("/participants", async (req, res) => {

    try {
        const participants = await db.collection("participants").find({}).toArray()
        res.send(participants)
    } catch (error) {
        res.sendStatus(500)
    }
})

app.listen(5000, () => {
    console.log('Listen on port 5000')
})