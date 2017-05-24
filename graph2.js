var NODE_DEFAULT_COLOR = '#fff';
var NODE_SELECTION_COLOR = '#00f';
var NODE_X_COLOR = '#7094B8';
var NODE_Y_COLOR = '#FF4D4D';
var NODE_RADIUS = 20;
var X = 'x';
var Y = 'y';
var PERMITTED_LABELS = ['x', 'y'];
var NOT_IDENTIFIABLE_ERROR = "Not identifiable";


//TODO test for slightly older browser version
//TODO maybe have a panel of pre-made graphs to choose from.


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
    initialize: function(x, y, canvas, nodeNumber,nodeLabel) {
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
        this.label = nodeLabel;

        this.connectionsOut = [];
        this.connectionsIn = [];

        canvas.add(this);
    },
    
    getID: function() {
        return ""+(this.label || "z"+this.nodeNumber);
        //return ""+(this.label || this.nodeNumber);
    },
    
    fillColor: function(){
        if (this.label.indexOf('x') != -1) {
            return NODE_X_COLOR;
        } else if (this.label.indexOf('y') != -1) {
            return NODE_Y_COLOR;
        } else {
            return NODE_DEFAULT_COLOR;
        }
    },
    
    _render: function(ctx) {
        this.callSuper('_render', ctx);
        var label = this.label || "unlabeled";
        ctx.font = '16px Helvetica';
        this.fill = this.fillColor();
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
        this.set({'fill': this.fillColor()});
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
        return this.get('left') + ',' + this.get('top')+","+this.get('label');
    }
});

function initialize() {
    
var graphHashes = ["#n=222,186,x1,374,185,y1&c=0,0,1",
"#n=222,186,x1,374,185,y1,294,80,z3&c=0,0,1,0,0,2,0,2,1,1,2,1",
"#n=222,186,x1,374,185,y1,294,80,z3&c=0,0,1,0,2,0,0,2,1,1,2,1",
"#n=222,186,x1,374,185,y1,294,80,z3&c=0,0,1,0,2,0,0,2,1,1,0,2",
"#n=201,186,x1,391,185,y1,298,186,z1&c=0,0,2,1,0,1,0,2,1",
"#n=202,185,x1,298,186,z1,392,187,z2,340,290,y1&c=0,0,1,0,0,3,1,0,2,0,1,2,0,1,3,1,1,3,0,2,3",
"#n=263,246,x1,364,246,z1,461,245,y1,364,123,z2,412,187,z3&c=0,0,1,1,0,3,1,0,4,0,1,2,1,2,0,0,3,4,0,3,0,1,3,2,0,4,2",
"#n=222,186,x1,374,185,y1&c=0,0,1,1,0,1",
"#n=61,68,z1,64,168,z2,124,166,z3,168,77,z4,198,163,z5,250,78,z6,290,173,z7,318,83,z8,388,82,z9,387,173,z10,450,83,z11,447,179,z12&c=1,0,1,0,0,1,0,2,3,0,3,4,0,5,6,0,7,6,0,8,9,0,10,11,1,10,11"]; 

var slide = $('.slider');
for (var i=0; i < graphHashes.length; i++) {
    var img = document.createElement('img');
    //img.src="graphs/graph"+(i+1)+".png";
    var graph = new Graph(graphHashes[i]);
    img.src = graph.canvas.toDataURL();
    img.className="graph";
    //img.graphHash = graphHashes[i];
    slide.append(img);
}

var slick = $('.slider').slick({
  infinite: true,
  slidesToShow: 3,
  slidesToScroll: 1,
  arrows:true,
  vertical:false,
});

$('.slider').on('click', function(event, slick, currentSlide, nextSlide){
    console.log(event);
    var element = event.target;
    var indx = element.attributes["data-slick-index"];
    if (indx) {
        var hash = graphHashes[parseInt(indx.value) % graphHashes.length];
        window.location.hash = hash;
    }
});

    
 
    
toastr.options = {
  "closeButton": false,
  "debug": false,
  "newestOnTop": false,
  "progressBar": false,
  "positionClass": "toast-top-left",
  "preventDuplicates": false,
  "onclick": null,
  "showDuration": "300",
  "hideDuration": "1000",
  "timeOut": "5000",
  "extendedTimeOut": "1000",
  "showEasing": "swing",
  "hideEasing": "linear",
  "showMethod": "fadeIn",
  "hideMethod": "fadeOut"
};   

var QUEUE = MathJax.Hub.queue;  // shorthand for the queue
    var math = null;                // the element jax for the math output.
    QUEUE.Push(function () {
      math = MathJax.Hub.getAllJax("MathOutput")[0];
    });
    window.UpdateMath = function (TeX) {
      QUEUE.Push(["Text",math,"\\displaystyle{"+TeX+"}"]);
 }
    
 document.getElementById("clear_button").addEventListener('click', function() {
    window.location.hash = ''; 
 });
 
 var graph = new Graph();
 var button2 = document.getElementById("calc_button");
 
 button2.addEventListener("click", function () {
      
      var intervened = graph.getNodeLabelsWithLabelsContaining(X);
      var target = graph.getNodeLabelsWithLabelsContaining(Y);
      var graphOk = true;
     
      if (intervened.length < 1){
          toastr["error"]("No nodes selected to intervene on", "Error"); 
          graphOk = false;
      }
     
      if (target.length < 1){
          toastr["error"]("No nodes selected as targets", "Error");
          graphOk = false;
      }
     
      if (graphOk) {  
         var data = new GraphData();
         data.load(graph);
         
         try {
             data.topologicalOrder();
         } catch (e) {
             toastr["error"]("Graph contains cycle(s)", "Error");
             return;
         }

         try {
            var distribution = new Distribution([],data.nodes());
            var result = identify(target,intervened,data,distribution);
            console.log("result",result.toString());
            result = result.toString();
         } catch (e) {
             if (e.message === NOT_IDENTIFIABLE_ERROR) {
                 result = false;
             } else {
                 throw e;
             }
         }


         var messagesDiv = document.getElementById("messages");
         messagesDiv.innerHTML="";


         if (result) {
             UpdateMath(math_condition(target,[],[intervened])+"="+result);
             messagesDiv.innerHTML = "";
             messagesDiv.style.color = "green";
         } else {
             UpdateMath("");
             //var mess = document.createElement("span");
             messagesDiv.innerHTML = "Query is not identifiable"
             messagesDiv.style.color = "red";
         }
      }
     
     
     //messagesDiv.appendChild(mess);
     
 });
    

}

var Graph = fabric.util.createClass({
    initialize: function(staticData) {
        var htmlCanvas = 'c';
        if (staticData) {
            htmlCanvas = null;
        }
        this.canvas = this.__canvas = new fabric.Canvas(htmlCanvas, { selection: false });
        fabric.Object.prototype.originX = fabric.Object.prototype.originY = 'center';
        
        this.resetState();
        
        if (staticData) {
            this.loadFromHash(staticData);
            var minX = Infinity;
            var minY = Infinity;
            var maxX = -Infinity;
            var maxY = -Infinity;
            for (var i = 0; i < this.nodes.length; i++) {
                minX = Math.min(minX, this.nodes[i].left);
                minY = Math.min(minY, this.nodes[i].top);
                maxX = Math.max(maxX, this.nodes[i].left);
                maxY = Math.max(maxY, this.nodes[i].top);
            }
            var margin = 3 * NODE_RADIUS;
            var shiftX = margin - minX;
            var shiftY = margin - minY;
            for (var i = 0; i < this.nodes.length; i++) {
                var node = this.nodes[i];
                node.left += shiftX;
                node.top += shiftY;
                node.moved();
            }
            this.canvas.setWidth(maxX - minX + margin * 2);
            this.canvas.setHeight(maxY - minY + margin * 2);
            this.canvas.calcOffset();
            this.canvas.renderAll();
            return;
        }
        
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
                this.createNode(e.e.offsetX, e.e.offsetY);
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
            } else if (e.keyIdentifier == 'U+005A'){  
                this.applyLabelToNode(this.selectedNode, 'z');
            } else { 
                return;
            }
            this.updateNodeNumbers()
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
        this.xCount =1;
        this.yCount =1;
        this.zCount=1;
    },
    endSelection: function() {
        if (this.selectedNode) {
            this.selectedNode.endSelection();
            this.selectedNode = null;
        }
    },
    
    getNodeLabelsWithLabelsContaining: function(value) {
        var result = [];
        for (var i = 0; i < this.nodes.length; i++) {
            var node = this.nodes[i];
            if (node.label.indexOf(value) != -1) {
                result.push(node.label);
            }
        }
        return result;
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
        this.xCount = 1;
        this.yCount = 1;
        this.zCount = 1;
        for (var i = 0; i < this.nodes.length; i++) {
            var node = this.nodes[i];
            var label = node.label;
            node.nodeNumber = i;
            
            if (label.indexOf('x') != -1) {
                node.setLabel('x'+this.xCount);
                this.xCount +=1;
            } else if (label.indexOf('y') != -1) {
                node.setLabel('y'+this.yCount);
                this.yCount +=1;
            } else {
                node.setLabel('z'+this.zCount);
                this.zCount +=1
            }
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
        this.currentHash = hash;
        window.location.hash = hash;
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
            map[keyAndValue[0]] = values;
        }
        var serializedNodes = map['n'];
        if (!serializedNodes) {
            return;
        }
        for (var i = 0; i < serializedNodes.length; i += 3) {
            var node = this.createNode(parseInt(serializedNodes[i]), parseInt(serializedNodes[i + 1]));
            node.setLabel(serializedNodes[i+2]);
        }
        var serializedConnections = map['c'];
        if (!serializedConnections) {
            return;
        }
        for (var i = 0; i < serializedConnections.length; i += 3) {
            var bidirectional = !!parseInt(serializedConnections[i]);
            var fromNode = this.nodes[parseInt(serializedConnections[i + 1])];
            var toNode = this.nodes[parseInt(serializedConnections[i + 2])];
            fromNode.toggleLineTo(toNode, bidirectional);
        }
        this.canvas.renderAll();
    },
    
    createNode: function(x, y) {
        var node = new Node(x, y, this.canvas, this.nodes.length,'z'+this.zCount);
        this.zCount +=1;
        this.nodes.push(node);
        return node;
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
        return "\\sum_{"+sumOver+"}";
    }
    return "";
}

function math_condition(left,conditionsArray,doConditionsArray) {
    var result = "P("+left;
    var first = true;
    for (var i = 0; i< conditionsArray.length; i++) {
        var conditions = conditionsArray[i];
        if (conditions.length > 0){
            if (first) {
                result +="|";
                first = false;
            } else {
                result+=",";
            }
            result+=conditions;
        }
    }
    if (doConditionsArray) {
        for (var i = 0; i< doConditionsArray.length; i++) {
            var conditions = doConditionsArray[i];
            if (conditions.length > 0){
                if (first) {
                    result +="|";
                    first = false;
                } else {
                    result+=",";
                }

                result+="do("+conditions+")";
            }
        }
    }
    
    result +=")";
    return result;
}




/** determine if P(y|do(x)) is identifiable in G. x and y are sets of nodes in G. **/
function identify(y,x,g,P) {
    console.log("P",P.toString());
    var v = g.nodes();
    // 1) If there are no variables on which to intervene
    if (x.length === 0) {
        return P.marginalize(v,y);//math_sum(v,y)+P;//"P("+y+")";
    }
    
    //2) If there are variables that are not ancestors of targets, we can just marginalize them out.
    var ancestorsOfY = g.ancestors(y);
    if (_.difference(v,ancestorsOfY).length > 0){
        var Pprime = P.marginalize(v,ancestorsOfY); //math_sum(v,ancestorsOfY)+P; // "P("+ancestorsOfY+")";//
        return identify(y,_.intersection(x,ancestorsOfY),g.subgraph(ancestorsOfY),Pprime);
    }
    
    //3) If there are variables on which intervening will have no effect on y given intervention on x.
    var gDox = g.withoutEdgesInto(x);
    var w = _.difference(_.difference(v,x),gDox.ancestors(y))
    if (w.length > 0) {
        return identify(y,_.union(x,w),g,P);
    }
    
    var gMinusX = g.subgraph(_.difference(v,x));
    var components = gMinusX.districts(); // districts of g_{v\x}
    
    //4) If problem decomposes
    if (components.length > 1) { // problem decomposes
        //var result = math_sum(v,_.union(y,x));
        var result = new Distribution();
        for (var i = 0; i < components.length; i++) {
            var c = components[i];
            var term = identify(c,_.difference(v,c),g,P);
            console.log("term",i,term.toString());
            result = result.product(term);
            //result += identify(c,_.difference(v,c),g,P);
        }
        result = result.marginalize(v,_.union(y,x));
        return result; 
        
    } else {
        var S = _.difference(v,x);
        var dg = g.districts()
        
        // 5) If D(G) = V
        if (dg.length === 1) {
            throw Error(NOT_IDENTIFIABLE_ERROR); 
        }
        
        // 6) If S is a component of D(G)
        if (_.find(dg, function(c){return sameElements(c,S);})) { 
            var order = g.topologicalOrder();
            var result = new Distribution();
            for (var i = 0; i < S.length; i ++) {
                var left = S[i];
                var right = order.slice(0,order.indexOf(left));
                result.addConditional(left,right);
            }
            result = result.marginalize(S,y); 
            return result;
            //return math_sum(S,y)+g.cfactor(S);
        }
        
        
        // 7) S is a subset of some component of D(G)
        var Sprime = _.find(dg,function(c){return subsetOf(S,c);})
        //var Pprime = "";
        var Pprime = new Distribution();
        var order = g.topologicalOrder();
        for (var i = 0; i < Sprime.length; i ++) {
            var variable = Sprime[i];
            var precedent = order.slice(0,order.indexOf(variable));
            var cond1 = _.intersection(Sprime,precedent);
            var cond2 = _.difference(precedent,Sprime);
            var cond = _.union(cond1,cond2); //TODO check this - I have not yet got the distriction between big and small conditioning ...
            Pprime.addConditional(variable,cond);
        }
        return identify(y,_.intersection(x,Sprime),g.subgraph(Sprime),Pprime);
        
    }
    
}

function math_sum(variables,without) {
    var sumOver = variables.filter(function(item){return !contains(without,item);});
    if (sumOver.length > 0){ 
        return "\\sum_{"+sumOver+"}";
    }
    return "";
}

var Distribution = fabric.util.createClass({
    initialize: function (terms, variables) {
        this.terms = terms || [];
        if (variables) {
            this.addJoint(variables);
        }
    },

    addJoint: function (variables) {
        var joint = {
            "variables": variables,
            "category": "joint",
            "toString": function () {
                return "P(" + this.variables + ")";
            }
        };
        this.terms.push(joint);
    },

    addConditional: function (left, right) {
        var conditional = {
            "left": left,
            "right": right,
            "category": "conditional",
            "toString": function () {
                var result = "P(" + this.left;
                if (right.length > 0) {
                    result += "|" + this.right;
                }
                result += ")";
                return result;
            }
        };
        this.terms.push(conditional);
    },

    addSum: function (sumOver) {
        if (sumOver.length > 0) {
            var sum = {
                "sumOver": sumOver,
                "category": "sum",
                "toString": function() {
                    return "\\sum_{"+sumOver+"}";
                }
            };
            this.terms.push(sum);
        }
    },

    marginalize: function (variables, without) {
        var sumOver = _.difference(variables, without);

        if (this.terms.length == 1 && this.terms[0].category == "joint") {
            var variables = _.difference(this.terms[0].variables, sumOver);
            return new Distribution([], variables);

        } else {
            var result = new Distribution(this.terms.slice());
            result.addSum(sumOver);
            return result;
        }
    },

    product: function (distribution) {
        var termsA = this.terms.slice();
        var termsB = distribution.terms.slice();
        return new Distribution(termsA.concat(termsB));
    },

    toString: function () {
        result = "";
        for (var i = this.terms.length - 1; i > -1; i--) {
            result += this.terms[i].toString();
        }
        return result;
    }
});

var GraphData = fabric.util.createClass({
    initialize: function () {
        this.children = {};
        this.parents = {};
        this.siblings = {};  
    },
    
    nodes:function() {
        return Object.keys(this.children).slice();
    },
    
    distribution: function(){
        return "P("+this.nodes()+")";  
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
    
    /** returns a copy of this graph without the edges into the specified nodes **/
    withoutEdgesInto: function(nodeSubset) {
        var sg = this.subgraph(this.nodes());
        for (var i = 0; i < nodeSubset.length; i++) {
            var node = nodeSubset[i];
            sg.parents[node] = [];
            sg.siblings[node] = [];
        }
        return sg;
    },
    
    /** returns all the ancestors of a node, includes specified node **/
    ancestors: function(nodes) {
        var result = [].concat(nodes);
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
    
    indexOfContainingComponent: function(components,variable) {
       for (var i = 0; i < components.length; i++) {
           if (contains(components[i],variable)){
               return i;
           }
       }
       return undefined;    
    },
    
    parentsOf: function(nodes){
        var result = [];
        for (var i = 0; i < nodes.length; i ++) {
            addUnique(result,this.parents[nodes[i]]);
        }
        return result;
    },
    
    cfactor: function(component){
        var result = "";
        var order = this.topologicalOrder();
        for (var i = 0; i < component.length; i++) {
            var variable = component[i];
            var cond = order.slice(0,order.indexOf(variable));
            result += math_condition(variable,[cond]);
        }
        return result;
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




