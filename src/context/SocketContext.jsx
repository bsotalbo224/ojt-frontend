import { createContext, useContext } from "react";
import socket from "../socket";

const socketContextValue = { socket };

const SocketContext = createContext(socketContextValue);

export const SocketProvider = ({ children }) => (
  <SocketContext.Provider value={socketContextValue}>
    {children}
  </SocketContext.Provider>
);

export const useSocket = () => useContext(SocketContext);

export default SocketContext;