# Adaptive Network Architecture Node Element (for nodejs)

Node.js microservice component , implemented by post: [Adaptive Network Architecture](https://cloudexpertise.blogspot.com/2020/07/adaptive-network-architecture-abstract.html). 

## Running Node Worker Cluster

make docker-compose.yml

```
version: '3'
services:
  nodeworker:
    restart: always
    image: vcomm/nodejsworker:cluster  
    container_name: nodeworkerjs  
    ports:
      - 5555:5555 
    environment:
      APP_NAME: "node worker application by using DAFSM"
```

Run these commands:

```
$ docker-compose up -d
$ docker-compose down
```

## REST API (Swagger UI)

```
<your-server>:5555/api
```

<a href="https://swagger.io/">
    <img src="https://user-images.githubusercontent.com/40527636/94268879-8016e880-ff46-11ea-9fc7-38583f597593.png" width="400" height="200">
</a>

## DAFSM   UI 

```
<your-server>:5555
```

<table>
  <tr>
    <th>Modeling</th>
    <th>Assignment</th>
    <th>Execution</th>
    <th>Fault Manage</th>
  </tr>
  <tr>
    <td> <img src="https://user-images.githubusercontent.com/40527636/94336433-f883b500-ffeb-11ea-8210-e2714a604819.png" width="200" height="100"> </td>
    <td> <img src="https://user-images.githubusercontent.com/40527636/94336474-2e289e00-ffec-11ea-9a52-109388fb2604.png" width="200" height="100"> </td>
    <td> <img src="https://user-images.githubusercontent.com/40527636/94336513-73e56680-ffec-11ea-928b-e483b4f958cd.png" width="200" height="100"> </td>
    <td> (coming soon) </td>
  </tr>
</table>

## Dynamic attachment finite state machine (DAFSM)

The feature of this approach is that automata, used for developing, are defined with the help of transition graphs. For distinguishing of the nodes of these graphs the term “state coding” is to be introduced. When using “multiple state coding” with the help of single variable it is possible to distinguish amount of states which is equal to the amount of variables values. This allows to introduce in programming the term “program observability”.   Using this method output actions are assigned to the arcs, loops or nodes of the transition graphs (mixed automata are to be used – Moore-Mealy automata).  Automata in such system can interact by nesting, by calling ability and with the help of state numbers interchange. System of interconnected automata forms system-independent part of software. Another important feature of this approach is that automata in it are used thrice: for specification, for implementation (they stay in the source code) and for drawing up the protocol, which is performed, as said above, in terms of automata. Last property allows to verify the propriety of automata system functioning. 

### Finite State Machine (FSM) 

A Finite State Machine (FSM) is the representation of a system in terms of its states and events. A state is simply a decision point at the system level , and an event is a stimulus that causes a state transition within the system. Therefore , a state machine stays in the current state until n event is received causing a state transition. If the state to transition to is the current state, a new state is not entered event though a state transition occurs.

### Mealy and Moore

Two well known types of state machine are the Mealy and Moore machines. The difference between these state machines is their output. The output of the Mealy state machine depends on the received event, while the output of the Moore state machine does not.

The functions defining the Moore state machine at transition t are: 

`S(t+1) = Function (S(t),I(t)); O(t+1) = Function (S(t))`

The functions defining the Mealy state machine at transition t are: 

`S(t+1) = Function (S(t),I(t)); O(t+1) = Function (S(t),I(t))`

While the state transition function S is same for both states machine, the output function O is different. The output of the Moore machine depends solely on the current state, while the output of the Mealy machine depends on both the current state and input.

### Deterministic and Non- Deterministic

In a state transition diagram, if no two outgoing edges of a state have the same label, then the corresponding machine is called a deterministic finite state machine …if two or more outgoing edges of a state have the same label, then it is called a non-deterministic finite state machine.

### State Diagram Notation (Graph)

State diagrams (also called State Chart diagrams) are used to help the developer better understand any complex/unusual functionalities or business flows of specialized areas of the system. In short, State diagrams depict the dynamic behavior of the entire system, or a sub-system, or even a single object in a system. This is done with the help of Behavioral elements.