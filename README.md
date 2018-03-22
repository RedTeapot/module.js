我们开发网页界面时，偶尔会遇到这样的问题：

> 浏览器执行脚本的顺序，与源码中声明的顺序不同

是的，确实是这样。
这并不是浏览器出了问题，而是客观存在，需要我们前端工程师要解决的问题。

这种现象有多种原因可以解释，例如：

> 1. 先加载的脚本体量大，后加载的脚本体量小；
> 2. 先加载的脚本在加载时，恰好服务端“卡”了一下；
> 3. 网络延迟等

通常的解决办法，是将有先后顺序要求的脚本合并为一个脚本。合并方式又有：

> 1. 发布时动态合并；
> 2. 在工程源码中手动静态合并；

我推荐“发布时动态合并”。因为源码合并，破坏了工程的可读性。


----------


但我今天要提出另一种方式，那就是：

> 允许方法先调用，后声明

具体来讲，就是引入一个“管家”，由管家实现延迟调用问题：

>  - 如果调用的时候，方法已经存在，则取出定义的方法体并执行；
>  - 如果方法并不存在，则暂存调用信息（参数等），等待方法声明；
>  - 方法声明时，如果存在暂存的调用信息，则依次执行。

当然，管家脚本要预先加载就绪，而且方法的调用方式，要更换为通过管家来调用。否则管家“管不住”。

完整代码如下所示（[module.js 的 Github源码][1]）：
```js
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
		
		/** 获取模块名称 */
		Object.defineProperty(this, "getName", {value: function(){
			return ops.name;
		}, configurable: false, enumerable: true, writable: false});
		
		/**
		 * 判断是否含有特定名称的方法
		 * @param name 方法名
		 */
		Object.defineProperty(this, "has", {value: function(name){
			return name in services;
		}, configurable: false, enumerable: true, writable: false});
		
		/**
		 * 定义方法
		 * @param name {String} 方法名
		 * @param func {Function} 方法体
		 */
		Object.defineProperty(this, "define", {value: function(name, func){
			if(null == name || "" == name.replace(/(^\s+)|(\s+$)/g, ""))
				throw new Error("Function name can not be null or empty");
			
			/* 检查方法是否存在 */
			if(name in services)
				throw new Error("Function of name: " + name + " exists already");
			
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
		}, configurable: false, enumerable: true, writable: false});
		
		/**
		 * 调用方法
		 * @param name {String} 方法名
		 * @param meta {Json} 方法元数据配置
		 * @param data {Json} 要传递的参数
		 */
		Object.defineProperty(this, "call", {value: function(name, data, meta){
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
		}, configurable: false, enumerable: true, writable: false});
	};
	
	/**
	 * 引用模块，如果指定名称的模块不存在则自动创建
	 * @param name {String} 模块名称
	 */
	Object.defineProperty(Module, "ofName", {value: function(name){
		if(name in modules)
			return modules[name];
		
		return new Module({name: name});
	}, configurable: false, enumerable: true, writable: false});
	
	attachContext.Module = Module;
})();
```


  [1]: https://github.com/RedTeapot/module.js