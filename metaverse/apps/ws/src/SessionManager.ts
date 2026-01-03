import { User } from "./User";
import { OutgoingMessage } from "./types";

//SessionManger is a singleton responsible for maintainance of users in a chat-session, this is similar to RoomManager

export class SessionManager {

    sessions: Map<string, User[]>
    static instance: SessionManager;

    private constructor(){
        this.sessions = new Map();
    }

    static getInstance() {
        if (!this.instance) {
            this.instance = new SessionManager();
        }
        return this.instance
    }

    public removeUser(user:User, sessionId: string) {
        if (!this.sessions.has(sessionId)) {
            return;
        }

        this.sessions.set(sessionId, this.sessions.get(sessionId)?.filter((u)=> u.id !== user.id) ?? [])
    }   

    public addUser(sessionId: string, user:User) {
        if(!this.sessions.has(sessionId)) {
            this.sessions.set(sessionId, [user]);
            return 
        }

        this.sessions.set(sessionId, [...(this.sessions.get(sessionId)??[]), user])
    }


    public broadcast(message: OutgoingMessage, user:User, sessionId:string){
        if(!this.sessions.has(sessionId)){
            return
        }

        this.sessions.get(sessionId)?.forEach((u)=>{
            if(u.id !== user.id){
                u.send(message)
            }
        })
        
    }

    public findUserById(id:string, sessionId: string){
        const session = this.sessions.get(sessionId)

        if(!session){
            return
        }

        return session.find((u)=> u.id == id) ?? null;
    }


}