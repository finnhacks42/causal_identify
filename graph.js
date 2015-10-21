var NODE_DEFAULT_COLOR = '#fff';
var NODE_SELECTION_COLOR = '#00f';
var NODE_RADIUS = 20;
var PERMITTED_LABELS = ['x', 'y'];

function removeFromArray(arr, elem) {
    for (var i = 0; i < arr.length; i++) {
        if (arr[i] == elem) {
            arr.splice(i, 1);
        }
    }
}

function bind(fn, self) {
    return function() {fn.apply(self, arguments);};
}

var NodeConnection = fabric.util.createClass(fabric.Path, {
    initialize: function(from, to, canvas, bidirectional) {
        this.callSuper('initialize', 'm 0 0 q 1 1 2 2', {
            fill: '',
            stroke: 'red',
            strokeWidth: 5,
            selectable: false
        });

        this.startTriangle = null;
        if (bidirectional) {
            this.startTriangle = new fabric.Triangle({
                fill: 'red',
                height: 20,
                width: 20,
                selectable: false
            });
            this.strokeDashArray = [8, 5];
        }
        this.endTriangle = new fabric.Triangle({
            fill: 'red',
            height: 20,
            width: 20,
            selectable: false
        });
        this.from = from;
        this.to = to;
        this.bidirectional = bidirectional;

        this.updatePosition();
        canvas.add(this);
        if (bidirectional) {
            canvas.add(this.startTriangle);
        }
        canvas.add(this.endTriangle);
        this.moveTo(0);
    },
    updatePosition: function() {
        this.path[0][1] = this.from.left;
        this.path[0][2] = this.from.top;
        var xDelta = this.to.left - this.from.left;
        var yDelta = this.to.top - this.from.top;
        var length = Math.sqrt(xDelta * xDelta + yDelta * yDelta);
        var s = this.bidirectional ? 0.5 : 0;
        this.path[1][1] = xDelta / 2 + yDelta * s;
        this.path[1][2] = yDelta / 2 - xDelta * s;
        this.path[1][3] = xDelta;
        this.path[1][4] = yDelta;
        var angleOffset = this.bidirectional ? Math.PI / 40 : 0;
        this.updateArrow(this.startTriangle, this.from.left, this.from.top, angleOffset);
        this.updateArrow(this.endTriangle, this.to.left, this.to.top, -angleOffset);
        this.setCoords();
    },
    updateArrow: function(triangle, x, y, angleOffset) {
        if (!triangle) {
            return;
        }
        var fromX = this.from.left + this.path[1][1];
        var fromY = this.from.top + this.path[1][2];
        var angle = -Math.atan2(fromX - x, fromY - y);
        angle += angleOffset;
        triangle.set('angle', angle / Math.PI * 180);
        triangle.set('left', x - NODE_RADIUS * 1.5 * Math.sin(angle));
        triangle.set('top', y + NODE_RADIUS * 1.5 * Math.cos(angle));
    },
    remove: function() {
        removeFromArray(this.from.connectionsOut, this);
        removeFromArray(this.to.connectionsIn, this);
        if (this.startTriangle) {
            this.canvas.remove(this.startTriangle);
        }
        this.canvas.remove(this.endTriangle);
        this.canvas.remove(this);
    },
    serialize: function() {
        return (this.bidirectional ? '1' : '0') + ',' +
            this.from.nodeNumber + ',' + this.to.nodeNumber;
    }
});

var Node = fabric.util.createClass(fabric.Circle, {
    initialize: function(x, y, canvas, nodeNumber) {
        this.callSuper('initialize', {
            left: x,
            top: y,
            strokeWidth: 3,
            radius: NODE_RADIUS,
            fill: NODE_DEFAULT_COLOR,
            stroke: '#666'
        });
        this.hasControls = false;
        this.hasBorders = false;
        this.nodeNumber = nodeNumber;

        this.connectionsOut = [];
        this.connectionsIn = [];

        canvas.add(this);
    },
    
    getID: function() {
        return ""+(this.label || "z"+this.nodeNumber);
        //return ""+(this.label || this.nodeNumber);
    },
    
    _render: function(ctx) {
        this.callSuper('_render', ctx);

        var label = this.label || "z"+this.nodeNumber;
        ctx.font = '16px Helvetica';
        ctx.fillStyle = '#333';
        ctx.fillText(label, -this.width/6, -this.height/2 + 20);
    },
    setLabel: function(label) {
        this.set('label', label);
    },
    moved: function() {
        var x = this.left;
        var y = this.top;
        for (var i = 0; i < this.connectionsOut.length; i++) {
            this.connectionsOut[i].updatePosition();
        }
        for (var i = 0; i < this.connectionsIn.length; i++) {
            this.connectionsIn[i].updatePosition();
        }
    },
    toggleLineTo: function(otherNode, bidirectional) {
        // If we already have exactly that connection, delete it.
        for (var i = 0; i < this.connectionsOut.length; i++) {
            var conn = this.connectionsOut[i];
            if (conn.to == otherNode && conn.bidirectional == bidirectional) {
                conn.remove();
                return;
            }
        }
        // If we have a connection in the opposite direction, replace it.
        for (var i = 0; i < this.connectionsIn.length; i++) {
            var conn = this.connectionsIn[i];
            if (conn.from == otherNode && conn.bidirectional == bidirectional) {
                conn.remove();
            }
        }
        var connection = new NodeConnection(this, otherNode, this.canvas, bidirectional);
        this.connectionsOut.push(connection);
        otherNode.connectionsIn.push(connection);
    },
    startSelection: function() {
        this.set({'fill': NODE_SELECTION_COLOR});
        this.canvas.renderAll();
    },
    endSelection: function() {
        this.set({'fill': NODE_DEFAULT_COLOR});
        this.canvas.renderAll();
    },
    remove: function() {
        var out = this.connectionsOut.slice(0);
        for (var i = 0; i < out.length; i++) {
            out[i].remove();
        }
        var cin = this.connectionsIn.slice(0);
        for (var i = 0; i < cin.length; i++) {
            cin[i].remove();
        }
        this.canvas.remove(this);
    },
    serialize: function() {
        return this.get('left') + ',' + this.get('top');
    }
});

function initialize() {
 var graph = new Graph();
 var button2 = document.getElementById("calc_button");
 button2.addEventListener("click", function () {
     
      if (!graph.getNodeWithLabel('x')){
          alert("No node set as x");
          return;
      }
      if (!graph.getNodeWithLabel('y')){
          alert("No node set as y");
          return;
      }
     var data = new GraphData();
     data.load(graph);
     console.log("Topological",data.topologicalOrder());
     var result = data.query();
     var messagesDiv = document.getElementById("messages");
     messagesDiv.innerHTML="";
     
     if (result) {
         var mess = MathJax.HTML.Element(
             "div", {
                 id: "MathDiv",
                 style: {
                     border: "1px solid",
                     padding: "5px"
                 }
             }, ["Here is math: \\(x+1\\)",["br"],"and a display $$x+1\\over x-1$$"]
         );
         //"Query is identifiable $$P(y|do(x)) = "+result+"$$"
     } else {
         var mess = document.createElement("span");
         mess.innerHTML = "Query is not identifiable"
         mess.style.color = "red";
     }
     
     
     messagesDiv.appendChild(mess);
     
 });
    

}

var Graph = fabric.util.createClass({
    initialize: function() {
        this.canvas = this.__canvas = new fabric.Canvas('c', { selection: false });
        fabric.Object.prototype.originX = fabric.Object.prototype.originY = 'center';
        
        this.resetState();
        
       
        this.canvas.on('mouse:down', bind(function(e) {
            this.mouseDownTarget = e.target;
        }, this));
        this.canvas.on('mouse:up', bind(function(e) {
            if (e.target) {
                if (e.target == this.mouseDownTarget) {
                    // Clicked on something
                    if (e.target instanceof Node) {
                        if (this.selectedNode) {
                            if (this.selectedNode != this.mouseDownTarget) {
                                this.selectedNode.toggleLineTo(this.mouseDownTarget, e.e.ctrlKey);
                            }
                            this.endSelection();
                        } else {
                            this.selectedNode = this.mouseDownTarget;
                            this.selectedNode.startSelection();
                        }
                    }
                }
            } else {
                // Clicked in open space, create new node.
                this.createNode(e.e.clientX, e.e.clientY);
                this.updateHash();
            }
            this.updateHash();
        }, this));
        
        document.onkeydown = bind(function(e) {
            if (e.keyIdentifier == 'U+007F') { // Delete
                // If we have a selected node, remove it.
                if (this.selectedNode) {
                    removeFromArray(this.nodes, this.selectedNode);
                    this.selectedNode.remove();
                    this.updateNodeNumbers();
                    this.selectedNode = null;
                }
            } else if (e.keyIdentifier == 'U+0058') { // x
                this.applyLabelToNode(this.selectedNode, 'x');
            } else if (e.keyIdentifier == 'U+0059') { // y
                this.applyLabelToNode(this.selectedNode, 'y');
            } else {
                return;
            }
            this.endSelection();
            this.updateHash();
            this.canvas.renderAll();
        }, this);

        this.canvas.on('object:moving', bind(function(e) {
            this.mouseDownTarget = null;
            e.target.moved();
            this.canvas.renderAll();
        }, this));

        window.onhashchange = bind(this.hashChanged, this);

        // Store graph as a global to make inspecting stuff easier
        window.graph = this;

        this.loadFromHash(window.location.hash);
    },
    resetState: function() {
        this.nodes = [];
        this.selectedNode = null;
        this.mouseDownTarget = null;
        this.currentHash = window.location.hash;
    },
    endSelection: function() {
        if (this.selectedNode) {
            this.selectedNode.endSelection();
            this.selectedNode = null;
        }
    },
    getNodeWithLabel: function(label) {
        for (var i = 0; i < this.nodes.length; i++) {
            var node = this.nodes[i];
            if (node.label == label) {
                return node;
            }
        }
        return null;
    },
    applyLabelToNode: function(node, label) {
        if (!node) {
            return;
        }
        var existingNode = this.getNodeWithLabel(label);
        if (existingNode) {
            existingNode.setLabel(null);
        }
        node.setLabel(label);
    },
    hashChanged: function() {
        var hash = window.location.hash;
        if (hash == this.currentHash) {
            return;
        }
        this.canvas.clear();
        this.resetState();
        this.loadFromHash(hash);
        this.currentHash = hash;
    },
    updateNodeNumbers: function() {
        for (var i = 0; i < this.nodes.length; i++) {
            this.nodes[i].nodeNumber = i;
        }
    },
    updateHash: function() {
        var serializedNodes = '';
        for (var i = 0; i < this.nodes.length; i++) {
            var node = this.nodes[i];
            if (serializedNodes.length > 0) {
                serializedNodes += ',';
            }
            serializedNodes += node.serialize();
        }
        var serializedConnections = '';
        for (var i = 0; i < this.nodes.length; i++) {
            var node = this.nodes[i];
            for (var j = 0; j < node.connectionsOut.length; j++) {
                if (serializedConnections.length > 0) {
                    serializedConnections += ',';
                }
                serializedConnections += node.connectionsOut[j].serialize();
            }
        }
        var hash = '#n=' + serializedNodes + '&c=' + serializedConnections;
        for (var i = 0; i < PERMITTED_LABELS.length; i++) {
            var label = PERMITTED_LABELS[i];
            var node = this.getNodeWithLabel(PERMITTED_LABELS[i]);
            if (node) {
                hash += '&' + label + '=' + node.nodeNumber;
            }
        }
        this.currentHash = hash;
        window.location.hash = hash;
    },
    createNode: function(x, y) {
        var node = new Node(x, y, this.canvas, this.nodes.length);
        this.nodes.push(node);
    },
    loadFromHash: function(hash) {
        if (hash.length > 1 && hash[0] == '#') {
            hash = hash.slice(1);
        }
        if (hash.length == 0) {
            return;
        }
        var map = {};
        var parts = hash.split('&');
        for (var i = 0; i < parts.length; i++) {
            var keyAndValue = parts[i].split('=');
            var values = keyAndValue[1].split(',');
            if (values.length == 1 && values[0] == '') {
                values = [];
            }
            for (var j = 0; j < values.length; j++) {
                values[j] = parseInt(values[j]);
            }
            map[keyAndValue[0]] = values;
        }
        var serializedNodes = map['n'];
        if (!serializedNodes) {
            return;
        }
        for (var i = 0; i < serializedNodes.length; i += 2) {
            this.createNode(serializedNodes[i], serializedNodes[i + 1]);
        }
        var serializedConnections = map['c'];
        if (!serializedConnections) {
            return;
        }
        for (var i = 0; i < serializedConnections.length; i += 3) {
            var bidirectional = !!serializedConnections[i];
            var fromNode = this.nodes[serializedConnections[i + 1]];
            var toNode = this.nodes[serializedConnections[i + 2]];
            fromNode.toggleLineTo(toNode, bidirectional);
        }
        for (var i = 0; i < PERMITTED_LABELS.length; i++) {
            var label = PERMITTED_LABELS[i];
            var values = map[label];
            if (values && values.length == 1) {
                var node = this.nodes[values[0]];
                this.applyLabelToNode(node, label);
            }
        }
        this.canvas.renderAll();
    },
    
});

function intersection(array1, array2) {
    return array1.filter(function(n) {return array2.indexOf(n) != -1});
}

function sameElements(a, b) {
    if (a === b) return true;
    if (a == null || b == null) return false;
    if (a.length != b.length) return false;
    a.sort();
    b.sort();
    for (var i = 0; i < a.length; ++i) {
        if (a[i] !== b[i]) return false;
    }
    return true;
}

/** Adds all elements from array2 that are not already in array 1 **/
function addUnique(array1, array2) {
    for (var i = 0; i < array2.length; i++) {
        var value = array2[i];
        if (!contains(array1,value)) {
            array1.push(value);
        }
    }
    return array1;
}

function contains(array,element) {
    for (var i = 0; i < array.length; i++) {
        if (array[i] == element) {
            return true;
        }
    }
    return false;
}

/** checks if array1 is a subset of array2 **/
function subsetOf(array1,array2){
    for (var i = 0; i < array1.length; i++) {
        if (!contains(array2,array1[i])){
            return false;
        }
    }
    return true;
}

function assert(condition, message) {
    if (!condition) {
        throw new Error(message || "Assertion failed");
    }
}

function math_sum(variables,without) {
    var sumOver = variables.filter(function(item){return !contains(without,item);});
    if (sumOver.length > 0){ 
        return "\sum_{"+sumOver+"}";
    }
    return "";
}

var GraphData = fabric.util.createClass({
    initialize: function () {
        this.children = {};
        this.parents = {};
        this.siblings = {};  
    },
    
    load: function(graph) {
        for (var i = 0; i < graph.nodes.length; i++) {
            var node = graph.nodes[i];
            var id = node.getID();
            this.parents[id] = [];
            this.children[id] = [];
            this.siblings[id] = [];
            
            for (var j = 0; j < node.connectionsIn.length; j++) {
                var conn = node.connectionsIn[j];
                var other = conn.from;
                var otherID = other.getID();
                if (conn.bidirectional) {
                    this.siblings[id].push(otherID);
                } else {
                    this.parents[id].push(otherID);        
                }
            }
            
             for (var j = 0; j < node.connectionsOut.length; j++) {
                var conn = node.connectionsOut[j];
                var other = conn.to;
                var otherID = other.getID();
                if (conn.bidirectional) {
                    this.siblings[id].push(otherID);
                } else {
                    this.children[id].push(otherID);        
                }
            }
        }  
        var ckeys = Object.keys(this.children);
        var pkeys = Object.keys(this.parents);
        var skeys = Object.keys(this.siblings);
        assert(sameElements(ckeys,pkeys),"childkeys:"+ckeys+", parentkeys:"+pkeys);
        assert(sameElements(ckeys,skeys),"childkeys:"+ckeys+", siblingkeys:"+skeys);
        this.logToConsole();
    },
    
     logToConsole: function() {
        console.log("GRAPH ---------------------")
        console.log("children:",JSON.stringify(this.children));
        console.log("parents:",JSON.stringify(this.parents));
        console.log("siblings:",JSON.stringify(this.siblings));
        console.log("---------------------------")
    },
    
    /**  creates a copy of this graph with only the nodes from the specified list and any edges connecting them. **/
    subgraph: function(nodes) {
        var sg = new GraphData();
        for (var i = 0; i < nodes.length; i ++) {
            var node = nodes[i];
            var sgchildren = intersection(nodes,this.children[node]);
            var sgparents = intersection(nodes,this.parents[node]);
            var sgsiblings = intersection(nodes,this.siblings[node]);
            sg.children[node] = sgchildren;
            sg.parents[node] = sgparents;
            sg.siblings[node] = sgsiblings;
        }
        return sg;
    },
    
    /** returns all the ancestors of a node **/
    ancestors: function(nodes) {
        var result = [];
        var expanded = true;
        while (expanded) {
            var currentSize = result.length;
            var parents = [];
            for (var i = 0; i < nodes.length; i++) {
                var node = nodes[i];
                addUnique(parents,this.parents[node])
            }
            addUnique(result,parents);
            expanded = result.length > currentSize;
            nodes = parents;
        }
        return result;
    },
    
    An: function(nodes) {
        return addUnique(this.ancestors(nodes),nodes);
    },
    
    topologicalOrder: function(){
        var ordered = [];
        var unsorted = JSON.parse(JSON.stringify(this.parents));
        while (Object.keys(unsorted).length > 0) {
            var acyclic = false;
            var keys = Object.keys(unsorted);
            for (var i = 0; i< keys.length; i++) {
                var node = keys[i];
                var parents = unsorted[node];
                
                var no_unprocessed = true;
                for (var j = 0; j < parents.length; j++) {
                    var parent = parents[j];
                    if (contains(keys,parent)){
                        var no_unprocessed = false;
                    }
                }
                
                if (no_unprocessed){
                    acyclic = true;
                    ordered.push(node);
                    delete unsorted[node];
                }
            }
            if (!acyclic) {
                throw new Error("A cyclic dependency occured");
            }
        }
        return ordered;
    },
    
    identify: function(C,T,Q) {
        console.log('Identify',C,T);
        var G_T = this.subgraph(T);
        var A = G_T.An(C);
        console.log('A',A);
        if (sameElements(A,C)) {
            return math_sum(T,C)+Q;
        }
        if (sameElements(A,T)) {
            return false;
        }
        if (subsetOf(C,A) & subsetOf(A,T)) {
            var G_A = this.subgraph(A);
            var components = G_A.districts();
            var T2 = components.find(function(element, index, array){
                return subsetOf(C,element);
            });
            
            if (T2 == null) {
                throw new Error('T2 should not be null');
            }
            
            var Q2 = math_sum(T,A)+Q;
            return this.identify(C,T2,Q2); 
        }
        
        throw new Error('Unexpected state in identify');
    },
    
    query:function() {
        var components = this.districts();
        console.log("components:"+ JSON.stringify(components));
        
        var c_factors = this.cfactors(components);
        console.log("cfactors",c_factors);
        
        var S_x_indx = this.indexOfContainingComponent(components,'x');
        var S_x = components[S_x_indx];
        var Q_S_x = c_factors[S_x_indx];
        
        console.log("S_x:",S_x);
        
        var nodes = Object.keys(this.children);
        var g_x = this.subgraph(nodes.filter(function(element){return element != 'x';}));
        
        var D = g_x.An('y');
        console.log("D",D)
        var D_x = intersection(D,S_x);
        console.log("D_x",D_x);
        var g_dx = this.subgraph(D_x);
        var g_dx_components = g_dx.districts();
        
        var Dterms = "";
        for (var i = 0; i < g_dx_components.length; i++) {
            var D_xj = g_dx_components[i];
            console.log("D_x_",i,D_xj);
            var Q_D_xj = this.identify(D_xj,S_x,Q_S_x);
            if (!Q_D_xj) {
                return false;
            }
            Dterms += Q_D_xj;
        }
        
        var term1 = math_sum(D,['y']);
    
        var term3 = "";
        for (var i = 0; i < components.length; i++) {
            if (i !== S_x_indx) {
                term3 += math_sum(components[i],D)+c_factors[i];
            }
        }
        
        return term1+Dterms+term3;
    },
    
    indexOfContainingComponent: function(components,variable) {
       for (var i = 0; i < components.length; i++) {
           if (contains(components[i],variable)){
               return i;
           }
       }
       return undefined;    
    },
    
    getParents: function(nodes){
        var result = [];
        for (var i = 0; i < nodes.length; i ++) {
            addUnique(result,this.parents[nodes[i]]);
        }
        return result;
    },
    
    cfactors:function(components) {
        var order = this.topologicalOrder();
        var factors = [];
        for (var i = 0; i < components.length; i++) {
            var component = components[i];
            var c_factor = "";
            for (var j = 0; j < component.length; j++ ){
                var variable = component[j];
                var v_i = order.slice(0,order.indexOf(variable)+1);
                var g_v_i = this.subgraph(v_i);
                var T_i = g_v_i.districts().find(function(gvi_component){return contains(gvi_component,variable)});
                var cond = this.getParents(T_i).filter(function(item){return item !== variable});
                var term = "P("+variable;
                if (cond.length > 0) {
                    term +="|"+cond;
                }
                term += ")";
                c_factor+=term;
            }
            factors.push(c_factor);
        }
        return factors;
    },
    
    districts: function() {
        var assigned = [];
        var result = [];
        var nodes = Object.keys(this.siblings);
        
        for (var i = 0; i < nodes.length; i++) {
            var node = nodes[i];
            if (!contains(assigned,node)) {
                var district = [node];
                this._findDistrict(node,district);
                addUnique(assigned,district);
                result.push(district);
            }
        }
        
        return result;
        
    },
    
    _findDistrict(node, district) {
         var nodeSiblings = this.siblings[node];
         for (var i = 0; i < nodeSiblings.length; i++) {
             var dest = nodeSiblings[i];
             if (!contains(district, dest)) {
                 district.push(dest);
                 this._findDistrict(dest, district);
             }
         }
    }
    
    
});

