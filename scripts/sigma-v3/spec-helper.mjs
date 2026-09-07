export const spec=(core,unit,decisions,variables,methods,falsifiers,forbidden,stops,boundaries,threats,cases)=>({core,unit,decisions,variables,methods,falsifiers,forbidden,stops,boundaries,threats,cases});
export const boundary=(withRole,owns,otherOwns,handshake,conflict)=>({with:withRole,owns,other_owns:otherOwns,handshake,conflict});
export const scenario=(name,mission,pressure,action,gate,outcome)=>({name,mission,pressure,action,gate,outcome});
