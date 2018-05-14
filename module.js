;(function(){
	var attachContext = window;
	
	/**
	 * 简化的defineProperty方法定义，用于兼容IE8
	 */
	;(function(){
		var rIE = /\bMSIE\s+((\d+)(\.\d+)*)\b/i;
		var ieMajorVersion = rIE.exec(navigator.userAgent);
		if(null != ieMajorVersion){
			ieMajorVersion = parseInt(ieMajorVersion[2]);
			if(ieMajorVersion <= 8)
				Object.defineProperty = function(obj, name, opt){
					obj[name] = opt.value;
				};
		}
	})();
	
	var modules = {};/* 所有创建的模块。key存放名称，value存放对象 */
	
	/**
	 * 为指定的对象添加事件驱动机制
	 * @param obj 要添加事件驱动机制的对象
	 * @param ctx 监听器触发时的this上下文
	 */
	var eventDrive = (function(){
		/**
		 * @constructor
		 * 
		 * 事件
		 * @param type {String} 事件类型（名称）
		 * @param data {JSON} 需要传递至监听器的数据 
		 */
		var Event = function(type, data){
			this.type = type;
			this.timestamp = new Date().getTime();
			this.data = data;
			
			Object.freeze && Object.freeze(this);
		};
	
		return function(obj, ctx){
			(function(obj, ctx){
				/* 所有事件处理器。key为事件类型字符串（全小写），value为对应添加的事件处理器数组 */
				var eventHandlers = {};
				
				/**
				 * 添加事件监听器
				 * @param type 事件类型
				 * @param handler 事件处理器
				 */
				obj.on = function(type, handler){
					type = type.toLowerCase();
					
					eventHandlers[type] = eventHandlers[type] || [];
					if(eventHandlers[type].indexOf(handler) != -1)
						return;
					
					/* 加入列表 */
					eventHandlers[type].push(handler);
				};
				
				/**
				 * 移除事件监听器
				 * @param type 事件类型
				 * @param handler 事件处理器
				 */
				obj.off = function(type, handler){
					type = type.toLowerCase();
						
					eventHandlers[type] = eventHandlers[type] || [];
					var index = eventHandlers[type].indexOf(handler);
					if(index == -1)
						return;
					
					/* 加入列表 */
					eventHandlers[type].splice(index, 1);
				};
				
				/**
				 * 触发事件
				 * @param type {String} 事件类型（名称）
				 * @param data 需要传递至监听器的数据
				 */
				obj.fire = function(type, data){
					type = type.toLowerCase();
					
					/** 创建事件 */
					var event = new Event(type, data);
					
					/** 触发监听器 */
					eventHandlers[type] = eventHandlers[type] || [];
					eventHandlers[type].forEach(function(handler){
						handler.call(ctx, event);
					});
				};
			})(obj, ctx);
		};
	})();

	/**
	 * 定义只读属性
	 * @param {Object} obj 目标对象
	 * @param {String} name 要定义的属性名称
	 * @param {Any} value 要定义的取值
	 */
	var defineReadonlyProperty = function(obj, name, value){
		if(name in obj)
			return;

		Object.defineProperty(obj, name, {value: value, writable: false, enumerable: true, });
	};
	
	/**
	 * 设定参数默认值
	 */
	var setDftValue = function(ops, dftOps){
		ops = ops || {};
		dftOps = dftOps || {};
		
		/* 参数不存在时，从默认参数中读取并赋值 */
		for(var p in dftOps)
		if(!(p in ops))
			ops[p] = dftOps[p];

		return ops;
	};
	
	/**
	 * 方法体元数据
	 */
	var metaset = {
		context: null,/* 方法执行上下文（this上下文） */
		defer: true/* 调用的方法不存在时，是否挂起，直至对应的方法被创建时再触发 */
	};
	
	/**
	 * @constructor
	 * 模块类
	 * @param ops {Json} 参数配置
	 * @param ops.name {String} 模块名称
	 */
	var Module = function(ops){
		ops = setDftValue(ops, {name: null});
		
		if(null == ops.name)
			throw new Error("No name specified");
		
		/* 名称唯一性检查 */
		if(ops.name in modules)
			throw new Error("Module of name: " + ops.name + " exists already");
		
		/* 存储该视图触发的各个事件的最新数据。key：事件名；value：数据 */
		var eventData = {};
		
		/* 添加事件驱动特性 */
		eventDrive(this);
		
		var fire = this.fire;
		this.fire = function(name, value){
			eventData[name] = value;
			fire(name, value);
		};
		
		/**
		 * 获取最新的，指定事件对应的数据
		 * @param {String} eventName 事件名字
		 */
		this.getLatestEventData = function(eventName){
			return eventData[eventName];
		};
		
		
		/* 保留引用 */
		modules[ops.name] = this;
		
		/** 提供的方法集合。key {String}：方法名称，value {Function}：方法体 */
		var services = {};
		/**
		 * 调用方法时，方法不存在从而记录下来的需要延迟触发的调用。
		 * key {String}：方法名称
		 * value {Json}：调用信息
		 * value.meta {Json}：调用元数据
		 * value.data {Any}：调用时需要传递的参数
		 */
		var deferedCalls = {};
		/** 数据上下文，用于模块的各个服务之间共享变量等 */
		var context = (function(){
			var obj = {};

			defineReadonlyProperty(obj, "has", function(name){
				return name in obj;
			});

			defineReadonlyProperty(obj, "set", function(name, value){
				obj[name] = value;
			});

			defineReadonlyProperty(obj, "get", function(name, value){
				return obj[name];
			});
			
			return obj;
		})();
		
		/** 获取模块名称 */
		defineReadonlyProperty(this, "getName", function(){
			return ops.name;
		});
		
		/** 获取上下文 */
		defineReadonlyProperty(this, "getContext", function(){
			return context;
		});
		
		/** 清空上下文 */
		defineReadonlyProperty(this, "clearContext", function(){
			context = {};
			return context;
		});

		/**
		 * 判断是否含有特定名称的方法
		 * @param name 方法名
		 */
		defineReadonlyProperty(this, "has", function(name){
			return name in services;
		});
		
		/**
		 * 定义方法
		 * @param name {String} 方法名
		 * @param func {Function} 方法体
		 */
		defineReadonlyProperty(this, "define", function(name, func){
			if(null == name || "" == name.replace(/(^\s+)|(\s+$)/g, "")){
				console.warn("Function name can not be null or empty");
				return this;
			}

			/* 检查方法是否存在 */
			if(name in services){
				console.warn("Function of name: " + name + " exists already.");
				return this;
			}
			
			if(typeof func !== "function")
				throw new TypeError(String(func) + " is not a valid function");
			
			services[name] = func;
			
			/* 触发挂起的调用 */
			deferedCalls[name] = deferedCalls[name] || [];
			if(deferedCalls[name].length > 0){
				console.log("Function of name: " + name + " is defined, calling " + deferedCalls[name].length + " deferred callbacks");
				
				setTimeout(function(){
					for(var i = 0; i < deferedCalls[name].length; i++){
						var call = deferedCalls[name][i];
						func.call(call.meta.context, {data: call.data});
					}
					delete deferedCalls[name];
				}, 0);
			}
			
			return this;
		});
		
		/**
		 * 调用方法
		 * @param name {String} 方法名
		 * @param meta {Json} 方法元数据配置
		 * @param data {Json} 要传递的参数
		 */
		defineReadonlyProperty(this, "call", function(name, data, meta){
			meta = setDftValue(meta, metaset);
			
			/* 判断方法是否存在，如果存在则立即调用，否则延迟触发（直至方法被创建后） */
			if(name in services){
				services[name].call(meta.context, {data: data});
			}else if(meta.defer){
				console.warn("Function of name: " + name + " does not exist, calling in a deferred mode");
				
				deferedCalls[name] = deferedCalls[name] || [];
				deferedCalls[name].push({meta: meta, data: data});
			}else
				throw new Error("Function of name: " + name + " does not exist");
			
			return this;
		});
	};
	
	/**
	 * 引用模块，如果指定名称的模块不存在则自动创建
	 * @param name {String} 模块名称
	 */
	defineReadonlyProperty(Module, "ofName", function(name){
		if(name in modules)
			return modules[name];
		
		return new Module({name: name});
	});
	
	attachContext.Module = Module;
})();