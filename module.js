/**
 * @intro：客户端模块组件创建类
 * 每个模块可以同时包含多个服务，模块可以进行全体广播，或指定听众的
 * 广播，发送特定消息。模块也可以监听广播，捕获自己需要的消息进行进
 * 一步的处理（同一服务可以被多个模块同时包含）
 * 模块包含的服务由模块自己声明。每个服务由服务名称和服务方法构成。
 * 服务名称在模块内唯一即可
 */
;window.Module = (function(){
	var modules = {};/* 所有创建的模块。key存放名称，value存放对象 */
	
	/**
	 * 用于获取临时唯一名称
	 */
	var getUniqueName = (function(){
		var count = 0;
		
		return function(){
			if(count >= 100)
				count = 0;
			
			return "TMPMODULE" + String(new Date().getTime()) + (count++);
		};
	})();
	
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
	 * 服务创建类
	 * @param ops.name：服务名称
	 * @param ops.service：服务方法
	 * @param ops.service#opts 服务方法接收的json参数
	 * @param ops.service#opts.data 调用者传递的数据
	 * @param ops.service#opts.notifier 通知者的模块信息
	 */
	var Service = function(ops){
		ops = setDftValue(ops, {name: "", service: function(){}});
		
		if(typeof ops.service !== "function")
			throw new Error("Service of: " + ops.name + " is not a valid function!");
		
		Object.defineProperty(this, "getName", {value: function(){return ops.name;}, configurable: false, enumerable: true, writable: false});
		Object.defineProperty(this, "service", {value: function(opts){
				return ops.service({data: opts.data, notifier: opts.ifier});
		}, configurable: false, enumerable: true, writable: false});
	};
	
	/**
	 * 模块服务请求方法
	 * @param ops.module：被通知的模块对象
	 * @param ops.service：接收到此消息的模块要提供服务的服务名称
	 * @param ops.data：调用服务所需的数据
	 * @param ops.notifier：调用模块的信息（由插件自动填入，用于完成安全控制等）。包含调用的模块名称等
	 * 方法返回服务方法的返回值
	 */
	var notify = function(ops){
		ops = setDftValue(ops, {module: null, service: "", data: null});
		
		/* 模块存在性检查 */
		if(!(ops.module instanceof Module))
			throw new Error("Module: " + ops.module + " is not a valid instance of Module.");
		
		return ops.module.service({name: ops.service, data: ops.data, notifier: ops.notifier});
	};
	
	/**
	 * 模块构造类
	 * @param ops.name：模块名称
	 */
	var _Module = function(ops){
		/* 设定模块默认值。包括：模块名称和定时器间隔（默认采取默认值）等 */
		ops = setDftValue(ops, {name: getUniqueName()});
		
		var services = {};/* 模块支持的服务集合。key存放服务名称，value存放服务对象 */
		
		var context = {};/* 数据上下文，用于模块的各个服务之间共享变量等 */
		
		/* 名称唯一性检查 */
		if(ops.name in modules)
			throw "Module: " + ops.name + " exists already.";
		
		/* 获取模块名称 */
		Object.defineProperty(this, "getName", {value: function(){return ops.name;}, configurable: false, enumerable: true, writable: false});
		
		/* 获取上下文 */
		Object.defineProperty(this, "getContext", {value: function(){return context;}, configurable: false, enumerable: true, writable: false});
		
		/* 清空上下文 */
		Object.defineProperty(this, "clearContext", {value: function(){context = {}; return context;}, configurable: false, enumerable: true, writable: false});
		
		/**
		 * 模块通知方法
		 * @param ops.module：被通知的模块。同时支持单个接收对象、正则表达式（匹配模块名称）和数组（模块对象列表）。
			默认使用正则表达式匹配所有模块以实现全体广播（包括自己）
		 * @param ops.service：接收到此消息的模块要提供服务的服务名称
		 * @param ops.data：调用服务所需的数据
		 * 方法返回值：
		 *	如果通知的模块为单个模块，则返回此模块被调用的服务的返回值；否则以数组的形式返回所有顺序调用的服务的返回值。
		 */
		Object.defineProperty(this, "notify", {value: function(ops){
			ops = setDftValue(ops, {module: /.*/, service: "", data: null});
			
			if(ops.module instanceof Array){/* 数组集合 */
				var ret = [];/* 返回值集合 */
				
				for(var i = 0; i < ops.module.length; i++)
					ret.push(notify({module: ops.module[i], service: ops.service, data: ops.data, notifier: {module: this.getName()}}));
				
				return ret;
			}else if(ops.module instanceof RegExp){/* 正则表达式 */
				var ret = [];/* 返回值集合 */
				
				for(var p in modules)
					if(ops.module.test(p))
						ret.push(notify({module: modules[p], service: ops.service, data: ops.data, notifier: {module: this.getName()}}));
				
				return ret;
			}else if(typeof ops.module === "string"){/* 普通单个对象的名称 */
				if(!(ops.module in modules))/* 如果模块不存在，则直接返回 */
					return;
				
				return notify({module: modules[ops.module], service: ops.service, data: ops.data, notifier: {module: this.getName()}});
			}else{/* 普通单个对象 */
				return notify({module: ops.module, service: ops.service, data: ops.data, notifier: {module: this.getName()}});
			}
		}, configurable: false, enumerable: true, writable: false});
		
		/**
		 * 声明服务
		 * @param ops.name 服务名称
		 * @param ops.defer 是否以defer方式创建服务。以defer方式创建（true）时，服务在创建（声明）后，将会调用所有以defer方式请求此服务的回调函数。
		 * 此选项多用于在保证脚本的顺序执行上。
		 * @param ops.service 服务方法
		 */
		Object.defineProperty(this, "claimService", {value: function(ops){
			ops = setDftValue(ops, {name: "", defer: false, service: function(){}});
			
			/* 模块内服务名称重复性检查 */
			if(this.offersService({name: ops.name}))
				throw new Error("There exists a service with the same name: " + ops.name + " in module: " + this.getName());
			
			services[ops.name] = new Service(ops);
			
			/* 标志属性 */
			services[ops.name].isDefer = ops.defer;
			
			if(ops.defer){
				/* 通知服务创建完成 */
				defer.ofName({name: "service@" + this.getName() + "#" + ops.name}).complete();
			}
		}, configurable: false, enumerable: true, writable: false});
		
		/**
		 * 根据指定的服务名称判断是否提供特定服务
		 * @param ops.name：服务名称
		 */
		Object.defineProperty(this, "offersService", {value: function(ops){
			return ops.name in services;
		}, configurable: false, enumerable: true, writable: false});
		
		/**
		 * 服务方法
		 * @param ops.service：模块所拥有的服务名称
		 * @param ops.data：调用者提供的数据
		 * @param ops.defer 是否以defer方式请求服务。如果服务声明时以defer方式创建，且此处以defer方式请求。则只有在服务创建完成后服务才会被调用
		 * 此选项多用于在保证脚本的顺序执行上。
		 * @param ops.notifier：调用者信息
		 * 方法返回服务方法的返回值
		 */
		Object.defineProperty(this, "service", {value: function(ops){
			ops = setDftValue(ops, {name: "", defer: false, data: null, notifier: null});
			
//			if(arguments.callee.caller !== notify)
//				throw new Error("Restrict access!");
			
			if(ops.defer){
				/**
				 * 指定defer时，如果服务不存在，则有可能是服务声明了，但尚未执行完毕或尚未加载完成。此时以defer方式完成请求，
				 * 可以使得服务加载完成或执行完毕后，服务请求仍可以被执行。如果服务不存在，但服务在创建时不是声明为defer模式，
				 * 则立即执行服务
				 */
				if(this.offersService({name: ops.name}) && !services[ops.name].isDefer)
					return services[ops.name].service({data: ops.data, notier: ops.notifier});
				else
					/* 注意：此时无法返回服务的返回值 */
					defer.oncomplete({name: "service@" + this.getName() + "#" + ops.name, f: function(){
						services[ops.name].service({data: ops.data, notifier: ops.notifier});
					}});
			}else{
				if(!this.offersService({name: ops.name}))
					throw new Error("Service: " + ops.name + " does not exist in module: " + this.getName());
				
				return services[ops.name].service({data: ops.data, notier: ops.notifier});
			}
		}, configurable: false, enumerable: true, writable: false});
		
		Object.freeze && Object.freeze(this);
		
		/* 保留引用 */
		modules[ops.name] = this;
	};
	
	/**
	 * 获取指定名称的模块。如果模块不存在，则使用指定的名称自动创建一个
	 * @param ops.name 模块名称
	 */
	_Module.get = function(ops){
		ops = setDftValue(ops, {name: ""});
		
		var module = modules[ops.name];
		module = null == module? new _Module(ops): module;
		
		return module;
	};
	
	return _Module;
})();