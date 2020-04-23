/*! $Id: tquery.js 2019.10.31 tQuery $
*******************************************************************************
            Copyright (c) 铁皮工作室 2019 MIT License

                @Project: tQuery v0.5.x
                @Author:  风林子 zhliner@gmail.com
*******************************************************************************

    轻量节点查询器

    应用 ES6 支持的新语法和API重构一个类jQuery的工具。

    接口类似jQuery，但仅包含其主要部分：DOM选择、DOM操作、CSS属性、Event 等。
    即省略了jQuery里的Ajax、$.Deferred、Effect。
    省略的这三个部分由浏览器自身的 Fetch、Promise、CSS3 支持。

    用户使用 $(...) 检索的元素集被命名为 Collector，继承于 Array。
    事件为DOM原生事件（无侵入），元素上也不存储任何数据。

    提示：
    可以在浏览器控制台执行：
    - console.dir($)  查看 $ 的成员情况（单元素操作版）。
      Object.keys($)  获取方法名集（可枚举）。
    - console.dir($('').__proto__)  查看 Collector 的成员情况。
      Object.getOwnPropertyNames($('').__proto__)  获取方法名集（不可枚举类）。

    注意！
    例：
        <p>
            <b>Bold, <i>Italic</i></b>
            <a>Link</a>
        </p>
        假设 p 为元素 <p>
    检索：
        Sizzle('>b', p)           => [<b>]
        p.querySelectorAll('>b')  => 语法错误
        Sizzle('p>b', p)          => []
        p.querySelectorAll('p>b') => [<b>]
    说明：
        querySelectorAll 拥有上下文元素自身的父级限定能力。
        Sizzle 选择器不包含上下文元素自身的匹配检查。

    实现：
        支持直系子元素选择器 '>xxx' 且可并列（如：'>a, >b'），同 Sizzle。
        tQuery.find('>a, >b', p) => [<b>, <a>]
        支持上下文元素限定（同 querySelectorAll）。
        tQuery.find('p>b', p)    => [<b>]


    定制事件：
    提供5组定制事件，用于监听DOM节点的变化。可方便实现节点修改的历史记录类应用。
    开启：tQuery.config({varyevent: true});

    - attrvary|attrfail/attrdone    // 特性设置/出错/完成
    - propvary|propfail/propdone    // 属性设置/出错/完成
    - cssvary|cssfail/cssdone       // 内联样式设置/出错/完成
    - classvary|classfail/classdone // 类名设置/出错/完成

    - nodevary|nodefail/nodedone
    // 节点设置/出错/完成
    // type: [
    //      append, prepend, before, after, replace,
    //      empty, remove, removesiblings, normalize
    // ]
    // 复合操作：fill, wrap, wrapInner, wrapAll, unwrap, html, text


&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&&
*/
(function( global, factory ) {

	"use strict";

	if ( typeof module === "object" && typeof module.exports === "object" ) {

		// See jQuery v3.4.1.
		module.exports = global.document ?
			factory( global, true ) :
			function( w ) {
				if ( !w.document ) {
					throw new Error( "tQuery requires a window with a document" );
				}
				return factory( w );
			};
	} else {
		factory( global );
	}

// Pass this if window is not defined yet
})( typeof window !== "undefined" ? window : this, function( window, noGlobal, undefined ) {

    "use strict";

    const
        Doc = window.document,

        // 主要用于扩展选择器。
        // 可选，默认无。
        Sizzle = window.Sizzle,

        isArr = Array.isArray,

        // 转换为数组。
        // 无条件转换，应当仅用于DOM原生元素集类。
        Arr = its => Array.from(its || ''),

        // 数组的检测转换。
        // 如果原参数为数组，直接返回。
        // 节点会被封装为数组，其它执行from转换。
        // @param  {Array|Node|.values} its
        // @return {Array}
        $A = its => isArr(its) ? its : its.nodeType && [its] || Array.from(its),

        // 单一目标。
        // slr: 包含前置#字符。
        // @param  {Document|DocumentFragment} ctx 上下文文档
        // @return {Element|null}
        $id = ( slr, ctx ) => ctx.getElementById( slr.substring(1) ),

        // 简单选择器。
        // @return {HtmlCollection}
        $tag = ( tag, ctx ) => ctx.getElementsByTagName(tag),

        // 简单选择器。
        // slr: 包含前置.字符
        // @return {HtmlCollection}
        $class = ( slr, ctx ) => ctx.getElementsByClassName(slr.substring(1)),

        // 检索元素或元素集。
        // 选择器支持“>”表示上下文元素限定。
        // fn: {String} querySelector[All]
        // @return {NodeList}
        $find = ( slr, ctx, fn ) => subslr.test(slr) ? $sub(slr, ctx, s => ctx[fn](s)) : ctx[fn](slr || null),

        // 单一目标。
        // slr 首字符 > 表示当前上下文父级限定。
        // @param  {String} slr 选择器。
        // @param  {Element|Document|DocumentFragment} ctx 上下文
        // @return {Element|null}
        $one = function( slr, ctx ) {
            if ( __reID.test(slr) && ctx.nodeType >= 9 ) {
                // 优化
                return $id(slr, ctx);
            }
            return $find( slr, ctx, 'querySelector' );
        },

        // 多目标。
        // slr 首字符 > 表示当前上下文父级限定。
        // 注记：不测试简单id，多id有效。
        // @param  {String} slr 选择器。
        // @param  {Element|Document|DocumentFragment} ctx 上下文
        // @return {[Element]}
        $all = Sizzle || function( slr, ctx ) {
            // if ( __reID.test(slr) ) {
            //     return new Array($id(slr, ctx) || 0);
            // }
            if ( __reTAG.test(slr) && ctx.nodeType != 11 ) {
                return Arr( $tag(slr, ctx) );
            }
            if ( __reCLASS.test(slr) && ctx.nodeType != 11 ) {
                return Arr( $class(slr, ctx) );
            }
            return Arr( $find(slr, ctx, 'querySelectorAll') );
        };


    const
        // 返回目标的类型。
        // 注：返回的是目标对象构造函数的名称，不会转为小写；
        // @param  {mixed} val 目标数据
        // @return {String} 类型名（如 "Array"）
        $type = function( val ) {
            if ( val == null ) {
                return String( val );
            }
            // Object.create(null) with no prototype.
            return Object.getPrototypeOf( val ) ? val.constructor.name : 'Object';
        },

        // 元素匹配判断。
        // - 如果不存在matches，外部需提供polyfill。
        // - 可以辅助过滤掉非元素值。
        // @param  {Element} el
        // @param  {String|Element} slr
        // @return {Boolean}
        $is = Sizzle && Sizzle.matchesSelector || function( el, slr ) {
            if (typeof slr != 'string') {
                return el === slr;
            }
            return slr[0] != '>' && !!el.matches && el.matches(slr);
        },

        // 是否包含判断。
        // @param  {Element} box 容器元素
        // @param  {node} 子节点
        // @return {Boolean}
        $contains = function( box, sub ) {
            return box.contains ?
                box.contains( sub ) :
                box === sub || box.compareDocumentPosition( sub ) & 16;
        },

        // 去除重复并排序。
        // 未传递comp实参时仅去除重复。
        // comp支持传递null获取默认的排序规则。
        // @param  {Array|Iterator} els
        // @param  {Function|null} comp 比较函数，可选
        // @return {Array} 结果集（新数组）
        uniqueSort = function( els, comp ) {
            els = [ ...new Set(els) ];

            if ( els.length == 1 ) {
                return els;
            }
            return comp === undefined ? els : els.sort(comp || undefined);
        },

        // 检查获取特性名。
        // 支持前置 '-' 为 data- 系名称简写。
        // @return {String}
        attrName = n => n[0] === '-' ? `data${n}` : n,

        // 获取data-系属性名。
        // 返回的名称已经转换为驼峰表示。
        // 如：data-abc-def | -abc-def => abcDef
        // @return {String|''}
        dataName = n => __dataName.test(n) && camelCase( n.match(__dataName)[1] ) || '';


    const
        // http://www.w3.org/TR/css3-selectors/#whitespace
        whitespace = "[\\x20\\t\\r\\n\\f]",

        // identifier: http://www.w3.org/TR/CSS21/syndata.html#value-def-identifier
        identifier = "(?:\\\\.|[\\w-]|[^\0-\\xa0])+",

        // 元素/实体类。
        ihtml = /<|&#?\w+;/,

        // HTML节点标志。
        xhtml = /HTML$/i,

        // 像素值表示
        rpixel = /^[+-]?\d[\d.e]*px$/i,

        // 并列选择器起始 > 模式
        // 如：`>p > em, >b a`
        // 注意！无法区分属性选择器属性值内包含的 ,> 字符序列。
        subslr = /^>|,\s*>/,

        // 伪Tag开始字符匹配（[）
        // 注：前置\时为转义，不匹配，偶数\\时匹配。
        tagLeft = /(^|[^\\]|[^\\](?:\\\\)+)\[/g,

        // 转义脱出 \[ => [
        // 注：在tagLeft替换之后采用。
        tagLeft0 = /\\\[/g,

        // 伪Tag结束字符匹配（]）
        // 注：同上
        tagRight = /([^\\]|[^\\](?:\\\\)+)\]/g,

        // 转义脱出 \] => ]
        // 注：在tagRight替换之后采用。
        tagRight0 = /\\\]/g,

        // 安全性：
        // 创建文档片段时清除的元素。
        // 注：用户应当使用 $.script()/$.style() 接口来导入资源。
        clearTags = ['script', 'style', 'link'],

        // 安全性：
        // 创建文档片段时清除的脚本类属性。
        // 注：用户应当使用 $.on 来绑定处理器。
        clearAttrs = ['onerror', 'onload', 'onabort'],

        // 表单控件值序列化。
        // 参考：jQuery-3.4.1 .serializeArray...
        rCRLF = /\r?\n/g,
        rsubmitterTypes = /^(?:submit|button|image|reset|file)$/i,
        rsubmittable = /^(?:input|select|textarea|keygen)/i,

        // SVG元素名称空间。
        svgNS = 'http://www.w3.org/2000/svg',

        // 简单选择器。
        // 用于原生ID/Class/Tag优先检索。
        __reID      = new RegExp( "^#(" + identifier + ")$" ),
        __reCLASS   = new RegExp( "^\\.(" + identifier + ")$" ),
        __reTAG     = new RegExp( "^(" + identifier + "|[*])$" ),

        // 空白匹配
        // 注：仅测试和切分（无需g）。
        __reSpace   = new RegExp( whitespace + "+" ),

        // data系属性名匹配。
        // 包含简写匹配，如：-val => data-val
        __dataName  = new RegExp( "^(?:data)?-(" + identifier + ")$" ),

        // 私有存储 {Element: String}
        // 用于toggleClass整体切换元素类名。
        __classNames = new WeakMap();


    const
        version = 'tQuery-0.5.0',

        // 临时属性名
        // 固定异样+动态，避免应用冲突。
        // 注：限制长度，约50天（0xffffffff）。
        hackFix = `___tquery_${ (Date.now() % 0xffffffff).toString(16) }_`,

        // 自我标志
        ownerToken = Symbol && Symbol() || hackFix,

        //
        // 位置值定义。
        // 用于插入元素的位置指定，可以混用名称与数值。
        // {
        //      before  =  1    元素之前
        //      after   = -1    元素之后
        //      begin   =  2    元素内起始点（头部）
        //      prepend =  2    同上
        //      end     = -2    元素内结束点（末尾）
        //      append  = -2    同上
        //      replace =  0    替换
        //      fill    = ''    内容填充（清除原有）
        // }
        // 示意：
        //   <!-- 1 -->
        //   <p>
        //      <!-- 2 -->
        //      <span>...</span>
        //      <!-- -2 -->
        //   </p>
        //   <!-- -1 -->
        //
        // 理解（记忆）：
        //   1： 表示与目标同级，只有1个层次。负值反向取末尾。
        //   2： 表示为目标子级元素，2个层次。负值取末尾。
        //   0： 替换。原目标已无（游离）。
        //   '': 填充。先设置内容为空串。
        //
        Wheres = {
            'before':   1,
            'after':   -1,
            'begin':    2,
            'prepend':  2,
            'end':     -2,
            'append':  -2,
            'replace':  0,
            'fill':    '',

            '1': 1,  '-1': -1,  '2': 2,  '-2': -2, '0': 0, '': '',
        },

        //
        // 可调用原生方法名（事件类）。
        // 它们被定义在元素上，同时存在如 xxx() 方法和 onxxx 属性。
        // 注：
        // 其中 submit() 和 load() 调用不会触发相应事件。
        //
        callableNative = [
            'blur',
            'click',
            'focus',
            'load',
            'pause',
            'play',
            'reset',
            // 'scroll',  // 定制
            'select',
            'submit',
        ],

        //
        // 功能配置集。
        // 注：
        // 目前仅支持节点变化事件，默认关闭。
        // 可通过 $.config({varyevent:true}) 开启。
        //
        Options  = { varyevent: false };



/**
 * 子级限定检索。
 * 对选择器首字符为 > 者实现上下文直接子元素限定检索。
 * 实现：
 * - 会对上下文元素添加一临时属性（如：___tquery_1562676388588_），
 * - 同时修改选择器（支持并列），形如：OL[___tquery_1562676388588_]>...
 * 例：
 * <ol> <!-- ctx -->
 *     <li></li>
 *     <li>
 *         <ol>
 *             <li></li>
 *             <li></li>
 *         </ol>
 *     </li>
 * </ol>
 * 假设ctx为上层<ol>
 * 检索：
 * - Sizzle('>li', ctx)  => 返回上级<li>
 * - ctx.querySelectorAll('>li')  => 语法错误
 * - $sub('>li', ctx, 'querySelectorAll')  => 同 Slizzle
 *
 * 另注意：
 * - Sizzle('ol>li', ctx)  => 返回末尾一个<li>（ctx:ol不检测匹配）
 * - ctx.querySelectorAll('ol>li')  => 返回两级<li>（ctx:ol参与检测匹配）
 *
 * @param  {Selector} slr 目标选择器
 * @param  {Element} ctx  父容器元素
 * @param  {Function} handle 检索回调
 * @return {Value} handle 的返回值
 */
function $sub( slr, ctx, handle ) {
    if (ctx.nodeType != 1) {
        return null;
    }
    try {
        hackAttr(ctx, hackFix);
        return handle( hackSelector(ctx, slr, hackFix) );
    }
    finally {
        hackAttrClear(ctx, hackFix);
    }
}


/**
 * 临时hack属性标记。
 * 针对选择器首字符为“>”的非标选择器构造元素属性限定。
 * @param  {Element} ctx 上下文容器元素
 * @param  {String} attr 属性名
 * @return {String} 属性选择器
 */
function hackAttr( ctx, attr ) {
    // 属性测试容错同名
    if ( !ctx.hasAttribute(attr) ) {
        ctx[ ownerToken ] = true;
        ctx.setAttribute( attr, '' );
    }
}


/**
 * 临时hack属性清除。
 * 注：与hackAttr配套使用。
 * @param {Element} ctx 上下文容器元素
 */
function hackAttrClear( ctx, attr ) {
    if ( ctx[ownerToken] ) {
        delete ctx[ ownerToken ];
        ctx.removeAttribute( attr );
    }
}


/**
 * 选择器串hack处理。
 * @param  {Element} ctx 上下文元素
 * @param  {String} slr 选择器（可能包含>）
 * @param  {String} fix Hack标识串
 * @param  {String} 处理后的合法选择器串
 */
function hackSelector( ctx, slr, fix ) {
    let _buf = [],
        _fix = `${ctx.nodeName}[${fix}]`;

    spliter.reset();

    for ( let ss of spliter.split(slr) ) {
        ss = ss.trimLeft();
        _buf.push( (ss[0] == '>' && _fix || '') + ss );
    }

    return _buf.join(', ');
}


/**
 * DOM 查询器。
 * - 查询结果为集合，即便只有一个元素。
 * - 传递无效的实参会构造为一个仅包含该实参的集合。
 * its: {
 *      String      选择器查询
 *      Element     元素封装
 *      NodeList    元素集（Symbol.iterator）
 *      .values     支持values接口的迭代器（如Set）
 *      Collector   简单返回实参
 *      ...         其它任意值封装
 * }
 * @param  {Mixed} its
 * @param  {Element} ctx 查询上下文
 * @return {Collector}
 */
function tQuery( its, ctx ) {
    if ( isCollector(its) ) {
        return its;
    }
    if (typeof its == 'string') {
        its = $all( its.trim(), ctx || Doc );
    }
    return new Collector( its );
}


//
// 功能配置。
// 目前仅支持 varyevent:{Boolean}
// 无参数调用返回内部配置对象的一个副本。
// 设置时返回的是内部原始的配置对象。
//
tQuery.config = option =>
    Object.assign( option && Options || {}, option || Options );


//
// 功能扩展区
// 外部扩展用，名称空间约定。
//
tQuery.Fx = {};



//
// 单元素版基础集定义。
//
Object.assign( tQuery, {

    //== 基本工具 =============================================================
    // 该部分没有集合版。


    /**
     * 创建DOM元素。
     * data为数据源：
     * - String作为HTML源码插入（可能创建新元素）。
     * - Object作为特性配置对象：{
     *      html:   值为源码
     *      text:   值为文本
     *      ....    特性（Attribute）定义
     * }
     * @param  {String} tag 标签名
     * @param  {String|Object} data 源码或置对象
     * @param  {String} ns 所属名称空间
     * @param  {Document} doc 所属文档
     * @return {Element} 新元素
     */
    Element( tag, data, ns, doc = Doc ) {
        let _el = ns ?
            doc.createElementNS(ns, tag) :
            doc.createElement(tag);

        return typeof data == 'string' ? fillElem(_el, data, doc) : setElem(_el, data);
    },


    /**
     * 创建一个文本节点。
     * - 如果data参数为节点元素，取其文本创建。
     * - data支持字符串或节点的数组，数组单元转为字符串后连接。
     * - 串连字符串sep仅在data为数组时才有意义。
     *
     * @param  {String|[String]|Node|[Node]} data 文本或节点元素或其数组
     * @param  {String} sep 数组成员间链接符，可选
     * @param  {Document} doc 所属文档
     * @return {Text} 新文本节点
     */
    Text( data, sep = ' ', doc = Doc ) {
        if (typeof data === 'object') {
            data = data && nodeText(data, sep);
        }
        return doc.createTextNode( data );
    },


    /**
     * 创建文档片段。
     * - <script>,<style>,<link>三种元素会默认被清除。
     * - [onerror],[onload],[onabort] 三个属性会被默认清除。
     * - 如果需要避免上面的清除行为，请明确传递clean为一个非null值。
     * - 如果需要保留默认的清理且传递文档实参，clean可为null值（占位）。
     * - 可以传递一个自己的函数自己处理尚未导入（document.adoptNode）的文档片段。
     *   接口：function(DocumentFragment): void。
     * 注：
     * 文档片段在被导入当前文档（document）之前，其中的脚本不会运行。
     *
     * @param  {String} html 源码
     * @param  {Function|null|false} clean 文档片段清理器，可选
     * @param  {Document} doc 所属文档，可选
     * @return {DocumentFragment} 文档片段
     */
    create( html, clean, doc = Doc ) {
        return typeof html == 'string' ?
            buildFragment( html, doc, clean ) : null;
    },


    /**
     * SVG系元素创建。
     * - 创建svg元素本身时标签名可省略，即首个参数为配置对象。
     *   如：$.svg( {width: 100, height: 200} )
     * - opts特性配置与 .Element 接口中的 data 参数类似，支持 html|text|node 特殊名称。
     * opts: {
     *      html:   取值为源码
     *      text:   取值为文本
     *      ....    特性（Attribute）值
     * }
     * @param  {String|Object} tag SVG子元素标签或svg元素配置
     * @param  {Object} opts 元素特性配置（Attribute），可选
     * @return {Element} 新元素
     */
    svg( tag, opts, doc = Doc ) {
        if (typeof tag != 'string') {
            opts = tag;
            tag = 'svg';
        }
        return setElem(doc.createElementNS(svgNS, tag), opts);
    },


    /**
     * 创建或封装Table实例。
     * vth 并不标准，但这样可以简单获得列表头的效果。
     * vth 为1表示首列为<th>，-1表示末尾列为<th>。
     * @param  {Number|Element} rows 表格行数或表格元素
     * @param  {Number} cols 表格列数
     * @param  {Number} vth 垂直列表头位置（1|-1），可选
     * @param  {Document} doc 所属文档对象
     * @return {Table} 表格实例
     */
    table( rows, cols, vth, doc = Doc ) {
        return new Table( rows, cols, vth, doc );
    },


    /**
     * 插入脚本元素。
     * - 用源码构建脚本元素并插入容器元素，返回脚本元素本身。
     * - 也可直接传递一个配置对象，返回一个Promise实例，then参数为脚本元素。
     * - 指定容器会保留插入的脚本元素，否则自动移除（脚本正常执行）。
     * 注记：
     * - 其它节点插入方法排除脚本源码，因此单独支持。
     * - 克隆的脚本元素修改属性后再插入，浏览器不会再次执行。
     *
     * @param  {String|Object} data 脚本代码或配置对象
     * @param  {Element} box DOM容器元素，可选
     * @return {Element|Promise} 脚本元素或承诺对象
     */
    script( data, box, doc = Doc ) {
        if ( typeof data == 'string' ) {
            data = { text: data };
        }
        if ( data.text != null ) {
            let _el = switchInsert(
                    setElem(doc.createElement('script'), data),
                    null,
                    box || doc.head
                );
            return box ? _el : _el.remove();
        }
        return loadElement( setElem(doc.createElement('script'), data), null, box || doc.head, !box );
    },


    /**
     * 插入样式元素。
     * - 用源码构建样式元素插入DOM，返回样式元素自身。
     * - 可以传递一个包含href配置的对象插入<link>元素，返回一个Promise对象。
     * - 默认插入head内部末尾，否则插入next之前。
     * 配置对象：{
     *      href:  {String}  <link>元素的CSS资源定位。
     *      rel:   {String}  <link>元素的属性（stylesheet）。可选
     *      text:  {String}  <style>元素的内容，也是决定创建<style>或<link>的判断依据
     *      scope: {Boolean} <style>元素的一个可选属性。
     * }
     * @param  {String|Object} data 样式代码或配置对象
     * @param  {Element} next 参考元素，可选
     * @return {Element|Promise} 样式元素或承诺对象
     */
    style( data, next, doc = Doc ) {
        if ( typeof data == 'string' ) {
            data = { text: data };
        }
        if ( data.text != null ) {
            return switchInsert(
                setElem(doc.createElement('style'), data),
                next,
                doc.head
            );
        }
        data.rel = data.rel || 'stylesheet';

        return loadElement( setElem(doc.createElement('link'), data), next, doc.head );
    },


    /**
     * 载入元素的外部资源。
     * 用于能够触发 load 事件的元素，如<img>。
     * 承诺对象的 resolve 回调由 load 事件触发，reject 回调由 error 事件触发。
     * 注：通常需要元素插入DOM树后才会执行资源载入。
     * @param  {Element} el 载入的目标元素
     * @param  {Node} next 插入参考位置（下一个节点）
     * @param  {Element} box 插入的目标容器，可选
     * @return {Promise} 载入承诺
     */
    loadin( el, next, box ) {
        return loadElement(el, next, box, false);
    },


    /**
     * 检测 XML 节点。
     * 注：from Sizzle CSS Selector Engine v2.3.4
     * @param {Element|Object} el An element or a document
     * @returns {Boolean} True iff el is a non-HTML XML node
     */
    isXML( el ) {
        let namespace = el.namespaceURI,
            docElem = (el.ownerDocument || el).documentElement;

        // Support: IE <=8
        // Assume HTML when documentElement doesn't yet exist, such as inside loading iframes
        // https://bugs.jquery.com/ticket/4833
        return !xhtml.test( namespace || docElem && docElem.nodeName || "HTML" );
    },


    /**
     * 包含检查。
     * - 检查容器节点是否包含目标节点。
     * - 目标即是容器本身也为真（与DOM标准兼容）。
     * 注：与jQuery.contains有所不同；
     * @param  {Element} box 容器节点
     * @param  {Node} node 检查目标
     * @return {Boolean}
     */
    contains( box, node ) {
        if (! node) {
            return false;
        }
        let _nt = node.nodeType;

        return (_nt == 1 || _nt == 3) && $contains(box, node);
    },


    /**
     * 元素的事件克隆。
     * - 支持不同种类元素之间的事件克隆，但仅限于元素自身。
     * - 可以指定匹配的事件名序列（空格分隔），不区分是否为委托。
     * - 如果没有目标事件被克隆，没有任何效果。
     * 过滤函数接口：function(evname, selector, handle): Boolean
     * 参数：{
     *      evname      事件名（单个）
     *      selector    委托选择器（可能前置>）
     *      handle      用户的事件处理函数
     * }
     * @param  {Element} to 克隆目标元素
     * @param  {Element} src 事件源元素
     * @param  {String|Function} evns 事件名序列或过滤函数，可选
     * @return {Element} to
     */
    cloneEvent( to, src, evns ) {
        if (to === src) {
            return to;
        }
        if ( typeof evns == 'string' ) {
            evns = evns.trim().split(__reSpace);
        }
        return Event.clone( to, src, evns );
    },


    /**
     * 集合去重&排序。
     * comp无实参传递时仅去重（无排序）。
     * comp: {
     *      true  DOM节点元素类排序
     *      null  重置为默认排序规则，用于非元素类
     * }
     * @param  {[Node]|Array|Object|.values} list 值集
     * @param  {Function|null|true} comp 排序比较函数，可选
     * @return {Array}
     */
    unique( list, comp ) {
        return uniqueSort( values(list), comp === true ? sortElements : comp );
    },


    /**
     * 获取表单元素内可提交类控件集。
     * 同名控件中用最后一个控件代表（用.val可获取值集）。
     * @param  {Element} form 表单元素
     * @return {[Element]} 控件集
     */
    controls( form ) {
        let _els = form.elements;

        if (!_els || _els.length == 0) {
            return [];
        }
        return uniqueNamed( Arr(_els).filter( submittable ) );
    },


    /**
     * 提取表单内可提交控件值为一个名值对数组。
     * 名值对：[
     *      name,   // {String} 控件名
     *      value   // {String} 控件值
     * ]
     * @param  {Element} form 表单元素
     * @param  {...String} names 指定的控件名序列
     * @return {[Array2]} 键值对数组
     */
    serialize( frm, ...names ) {
        if ( names.length == 0 ) {
            return [...new FormData(frm).entries()];
        }
        let _els = tQuery.controls(frm);

        if (_els.length > 0) {
            _els = _els.filter( el => names.includes(el.name) );
        }
        return arr2Flat( cleanMap(_els, submitValues) );
    },


    /**
     * 名值对数组/对象构造URL查询串。
     * 名值对：[name, value]
     * @param  {[Array2]|Object|Map|Element} target 名值对数组或表单元素
     * @return {String} URL查询串
     */
    queryURL( target ) {
        if ( target.nodeType ) {
            target = tQuery.serialize(target);
        }
        else if ( !isArr(target) ) {
            target = $A( entries(target) );
        }
        return new URLSearchParams(target).toString();
    },


    /**
     * 文档就绪绑定。
     * - 可以绑定多个，会按绑定先后逐个调用。
     * - 若文档已载入并且未被hold，会立即执行。
     *
     * @param  {Function} handle 就绪回调
     * @return {this}
     */
    ready( handle ) {
        if (handle === this) {
            throw new Error('bad bind for ready');
        }
        domReady.bind(
            handle,
            // 如果被holdReady，不会实际执行handle，但可标记loaded
            // 然后hold释放完就会调用handle了
            () => (domReady.ready(), domReady.loaded = true)
        );
        return this;
    },


    /**
     * 暂停或恢复.ready()注册的执行。
     * - 应当在页面加载的前段调用，传递true暂停.ready()注册的执行。
     * - 如果需要恢复.ready()调用，传递false实参即可。
     * - 可能有多个.ready()的注册，一次.holdReady()对应一次.ready()。
     * - 如果文档已就绪并已调用ready()，本操作无效（同jQuery）。
     * @param {Boolean} hold 持有或释放
     * @return {void}
     */
    holdReady( hold ) {
        if (domReady.passed) {
            return;
        }
        domReady.waits += hold ? 1 : -1;

        // load 限定！
        return domReady.loaded && domReady.ready();
    },


    //== DOM 节点查询 =========================================================


    /**
     * 查询单个元素。
     * - 先尝试$one（querySelector或ID定位）。
     * - 失败后尝试Sizzle（非标准CSS选择器时）。
     * 注：上下文明确为假时返回该假值。
     * @param  {String} slr 选择器
     * @param  {Element|Document|DocumentFragment|null} ctx 查询上下文
     * @return {Element|null}
     */
    get( slr, ctx = Doc ) {
        slr = slr || '';
        try {
            return ctx && $one(slr.trim(), ctx);
        }
        catch( e ) {
            if ( !Sizzle ) throw e;
        }
        return Sizzle( slr, ctx )[0] || null;
    },


    /**
     * 查找匹配的元素集。
     * @param  {String} slr 选择器
     * @param  {Element|Document|DocumentFragment|null} ctx 查询上下文
     * @param  {Boolean} andOwn 包含上下文自身匹配
     * @return {[Element]}
     */
    find( slr, ctx = Doc, andOwn = false ) {
        if ( !ctx ) {
            return [];
        }
        slr = slr || '';
        let _els = $all( slr.trim(), ctx );

        if ( andOwn && $is(ctx, slr) ) {
            _els.unshift(ctx);
        }
        return _els;
    },


    //-- DOM 集合过滤 ---------------------------------------------------------
    // 集合仅适用于数组，如果需要支持类数组和Set等，可用Collector集合版。
    // 注：代码与集合版相似。


    /**
     * 匹配过滤。
     * 支持任意值的集合。
     * fltr: {
     *  - String:   作为元素的CSS选择器，集合内成员必须是元素。
     *  - Array:    集合内成员在数组内，值任意。注：集合的交集。
     *  - Function: 自定义测试函数，接口：function(Value, Index, this): Boolean。
     *  - Value:    其它任意类型值，相等为匹配（===）。
     * }
     * @param  {[Element|Value]} list 目标集
     * @param  {String|Array|Function|Value} fltr 匹配条件
     * @return {[Value]} 过滤后的集合
     */
    filter( list, fltr ) {
        return list.length ? list.filter( getFltr(fltr) ) : list;
    },


    /**
     * 排除过滤。
     * - 从集合中移除匹配的成员。
     * - 自定义测试函数接口同上。
     * @param  {[Element|Value]} list 目标集
     * @param  {String|Array|Function|Value} fltr 排除条件
     * @return {[Value]}
     */
    not( list, fltr ) {
        if ( list.length == 0 ) {
            return list;
        }
        let _fun = getFltr( fltr );

        return list.filter( (v, i, o) => !_fun(v, i, o) );
    },


    /**
     * 元素包含过滤。
     * 检查集合中元素的子级元素是否可与目标匹配。
     * 注：仅支持由元素构成的集合。
     * @param  {[Element]} els 元素集
     * @param  {String|Element} slr 测试目标
     * @return {[Element]}
     */
    has( els, slr ) {
        return els.length ? els.filter( hasFltr(slr) ) : els;
    },


    //-- DOM 节点遍历 ---------------------------------------------------------

    /**
     * 获取下一个兄弟元素。
     * slr用于匹配测试，不匹配时返回null。
     * 如果until为真，则持续测试直到匹配或末尾。
     * slr作为测试函数仅在until为真时有效。
     * 注：与 jQuery.next(slr) 行为不同。
     * @param  {Element} el 参考元素
     * @param  {String|Function} slr 匹配选择器或测试函数，可选
     * @param  {Boolean} until 持续测试
     * @return {Element|null}
     */
    next( el, slr, until ) {
        return until ?
            _sibling2(el, slr, 'nextElementSibling') :
            _sibling(el, slr, 'nextElementSibling');
    },


    /**
     * 获取后续全部兄弟元素。
     * 可用slr进行匹配过滤，可选。
     * @param  {Element} el 参考元素
     * @param  {String|Function} slr 匹配选择器，可选
     * @return {[Element]}
     */
    nextAll( el, slr ) {
        return _siblingAll(el, slr, 'nextElementSibling');
    },


    /**
     * 获取后续兄弟元素，直到slr匹配（不包含匹配的元素）。
     * 注记：slr默认为空串是必须的。
     * @param  {Element} el 参考元素
     * @param  {String|Element|Function} slr 终止条件，可选
     * @return {[Element]}
     */
    nextUntil( el, slr = '' ) {
        return _siblingUntil(el, slr, 'nextElementSibling');
    },


    /**
     * 获取前一个兄弟元素。
     * 参数说明参考.next()。
     * @param  {Element} el 参考元素
     * @param  {String|Function} slr 匹配选择器或测试函数，可选
     * @param  {Boolean} until 持续测试
     * @return {Element|null}
     */
    prev( el, slr, until ) {
        return until ?
            _sibling2(el, slr, 'previousElementSibling') :
            _sibling(el, slr, 'previousElementSibling');
    },


    /**
     * 获取前部全部兄弟。
     * 可选的用slr进行匹配过滤。
     * 注：结果集保持逆向顺序（靠近起点的元素在前）。
     * @param  {Element} el 参考元素
     * @param  {String|Function} slr 匹配选择器，可选
     * @return {[Element]}
     */
    prevAll( el, slr ) {
        return _siblingAll(el, slr, 'previousElementSibling');
    },


    /**
     * 获取前端兄弟元素，直到slr匹配（不包含匹配的元素）。
     * 注：结果集成员保持逆向顺序。
     * @param  {Element} el 参考元素
     * @param  {String|Element} slr 选择器或元素，可选
     * @return {[Element]}
     */
    prevUntil( el, slr = '' ) {
        return _siblingUntil(el, slr, 'previousElementSibling');
    },


    /**
     * 获取直接子元素（集）。
     * 可以指定具体位置获取单个元素（优于选择器）。
     * 数字位置支持负数从末尾算起。
     * 注：兼容字符串数字，但空串不为0。
     * @param  {Element} el 容器元素
     * @param  {String|Number} slr 过滤选择器或下标，可选
     * @return {[Element]|Element}
     */
    children( el, slr ) {
        let _els = Arr(el.children);

        if ( !slr ) {
            return slr === 0 ? _els[0] : _els;
        }
        return isNaN(slr) ? _els.filter(e => $is(e, slr)) : indexItem(_els, +slr);
    },


    /**
     * 获取元素内容。
     * - 默认返回元素内的全部子元素和非空文本节点。
     * - 传递 comment 为真表示包含注释节点。
     * - 可以指定仅返回目标位置的一个子节点。
     * - 位置计数不含空文本节点，支持负值从末尾算起。
     * @param  {Element} el 容器元素
     * @param  {Number|null} idx 子节点位置（从0开始）
     * @param  {Boolean} comment 包含注释节点
     * @return {[Node]|Node}
     */
    contents( el, idx, comment = false ) {
        let _proc = comment ?
                usualNode :
                masterNode,
            _nds = Arr(el.childNodes).filter(_proc);

        // 兼容字符串数字，但空串不为0。
        return idx ? indexItem(_nds, +idx) : (idx === 0 ? _nds[0] : _nds);
    },


    /**
     * 获取当前元素的兄弟元素。
     * 目标元素需要在一个父元素内，否则返回null（游离节点）。
     * @param  {Element} el 参考元素
     * @param  {String} slr 过滤选择器，可选
     * @return {[Element]|null}
     */
    siblings( el, slr ) {
        let _pel = el.parentElement;
        if (_pel == null) {
            return null;
        }
        let _els = Arr(_pel.children);
        _els.splice(_els.indexOf(el), 1);

        return slr ? _els.filter(e => $is(e, slr)) : _els;
    },


    /**
     * 获取直接父元素。
     * 可用可选的选择器或测试函数检查是否匹配。
     * @param  {Element} el 目标元素
     * @param  {String|Function} slr 选择器或测试函数，可选
     * @return {Element|null}
     */
    parent( el, slr ) {
        let _pel = el.parentNode;

        if ( !_pel ) {
            return null;
        }
        if ( isFunc(slr) ) {
            return slr(_pel) ? _pel : null;
        }
        return !slr || $is(_pel, slr) ? _pel : null;
    },


    /**
     * 获取目标元素的上级元素集。
     * - 可用可选的选择器或测试函数进行过滤。
     * - 自定义测试函数支持向上递进的层计数（_i）。
     * 注：最终的顶层不是document而是html。
     * @param  {Element} el 目标元素
     * @param  {String|Function} slr 选择器或测试函数，可选
     * @return {[Element]}
     */
    parents( el, slr ) {
        let _buf = [],
            _fun = getFltr(slr),
            _i = 0;

        while ( (el = el.parentElement) ) {
            _buf.push(el);
        }
        return _buf.filter( e => _fun(e, ++_i) );
    },


    /**
     * 汇集当前元素的全部上级元素，直到匹配。
     * - 从父元素开始检查匹配。
     * - 不包含终止匹配的父级元素。
     * - 自定义测试函数支持向上递进的层计数（_i）。
     * @param  {Element} el 当前元素
     * @param  {String|Function|Element|[Element]} slr 终止匹配
     * @return {[Element]}
     */
    parentsUntil( el, slr = '' ) {
        let _buf = [],
            _fun = getFltr( slr ),
            _i = 0;

        while ( (el = el.parentElement) ) {
            if ( _fun(el, ++_i) ) break;
            _buf.push(el);
        }
        return _buf;
    },


    /**
     * 获取最近的匹配的父级元素。
     * - 向上逐级检查父级元素是否匹配。
     * - 从当前元素自身开始测试（同标准 Element:closest）。
     * - 如果抵达document或DocumentFragment会返回null。
     * - 自定义匹配函数支持向上递进的层数（_i）。
     * - 未传入slr时无任何匹配（Element.closest抛出异常）。
     * @param  {Element} el 参考元素
     * @param  {String|Function|Element|[Element]} slr 匹配选择器
     * @return {Element|null}
     */
    closest( el, slr = '' ) {
        if (el.closest && typeof slr == 'string') {
            return el.closest( slr );
        }
        let _fun = getFltr( slr ),
            _i = 0;

        while ( el && !_fun(el, _i++) ) {
            el = el.parentElement;
        }
        return el;
    },


    /**
     * 获取最近父级定位元素（css::position: relative|absolute|fixed）。
     * - 从父元素开始检查匹配。
     * - 如果最终没有匹配返回文档根（<html>，同jQuery）。
     * - 如果当前元素属于SVG子节点，会返回svg元素本身。注：SVG节点定位由属性配置，与style无关。
     * 注记：
     * 元素原生拥有offsetParent属性，但若元素隐藏（display:none），该属性值为null。
     * 此接口不管元素是否隐藏，都会返回position为非static的容器元素。
     *
     * @param  {Element} el 参考元素
     * @return {Element}
     */
    offsetParent( el ) {
        let _pel = el.parentElement,
            _css = getStyles(el);

        while ( _pel ) {
            let _csp = getStyles(_pel),
                _its = offsetBox(_pel, _csp, el, _css);

            if ( _its ) return _its;

            _css = _csp;
            el = _pel;
            _pel = el.parentElement;
        }

        return el.ownerDocument.documentElement;
    },


    //-- DOM 节点操作 ---------------------------------------------------------
    // 注：before after prepend append replace fill 见后统一定义


    /**
     * 外层包裹。
     * - 在目标节点外包一层元素（容器）。
     * - 包裹容器可以是一个现有的元素或HTML结构字符串或取值函数。
     * - 取值函数：function(node): Element|string
     * - 包裹采用结构字符串时，会递进至最深层子元素为容器。
     * - 被包裹的内容插入到容器元素的前端（与jQuery不同）。
     * 注记：
     * 插入到容器内前端有更好的可用性（可变CSS选择器）。
     *
     * @param  {Node|String} node 目标节点或文本
     * @param  {HTML|Element|Function} box 包裹容器
     * @param  {Boolean} clone 包裹元素是否克隆
     * @param  {Boolean} event 包裹元素上注册的事件处理器是否克隆
     * @param  {Boolean} eventdeep 包裹元素子孙元素上注册的事件处理器是否克隆
     * @return {Element} 包裹的容器根元素
     */
    wrap( node, box, clone, event, eventdeep, doc = Doc ) {
        if ( typeof node === 'string' ) {
            node = doc.createTextNode(node);
        }
        if ( isFunc(box) ) {
            box = box( node );
        }
        let [_box, _root] = wrapBox(box, clone, event, eventdeep, doc);

        return varyWrap( node, _root || _box, _box );
    },


    /**
     * 内层包裹。
     * - 在目标元素内嵌一层包裹元素（即对内容wrap）。
     * - 取值函数：function(el): Element|string
     * @param  {Element} el 目标元素
     * @param  {HTML|Element|Function} box 包裹容器
     * @param  {Boolean} clone 包裹元素是否克隆
     * @param  {Boolean} event 包裹元素上注册的事件处理器是否克隆
     * @param  {Boolean} eventdeep 包裹元素子孙元素上注册的事件处理器是否克隆
     * @return {Element} 包裹的容器元素
     */
    wrapInner( el, box, clone, event, eventdeep ) {
        if ( isFunc(box) ) {
            box = box( el );
        }
        let [_box, _root] = wrapBox(box, clone, event, eventdeep, el.ownerDocument);

        // 容器可以是子元素。
        if ( $contains(el, _box) ) {
            varyRemove(_box, _box.parentElement);
        }
        return varyWrapInner( el, _root || _box, _box );
    },


    /**
     * 元素解包裹。
     * - 用元素内容替换元素本身（内容上升到父级）。
     * - 内容可能包含注释节点和空文本节点，会从返回集中清除。
     * @param  {Element} el 容器元素
     * @return {[Node]} 容器子节点集
     */
    unwrap( el ) {
        if (el.nodeType != 1) {
            throw new Error('el must be a Element');
        }
        return varyNewNodes(
            el,
            'replaceWith',
            // 优化
            varyEmpty(el)
        )
        .filter( masterNode );
    },


    /**
     * 移除节点（从DOM中）。
     * @param  {Node} node 节点元素
     * @return {Node} 原节点引用
     */
    remove( node ) {
        return varyRemove( node, node.parentElement );
    },


    /**
     * 移除同级节点集（从DOM中）。
     * 节点集成员或筛选出的节点仅限于同级兄弟关系。
     * 注：这是对使用事件激发（varyevent:true）的一个优化。
     * @param  {[Node]} subs 目标节点集
     * @param  {String|Function} slr 过滤选择器
     * @return {[Node]} 被移出节点集
     */
    removeSiblings( subs, slr ) {
        if ( slr ) {
            subs = subs.filter( getFltr(slr) );
        }
        return varyRemoves( subs, subs[0].parentElement );
    },


    /**
     * 清空元素内容。
     * 仅适用于元素节点，非法实参返回一个空数组。
     * 返回集中不包含注释节点和纯空白文本节点。
     * @param  {Element} el 目标元素
     * @return {[Node]} 被清除的节点集
     */
    empty( el ) {
        if (el.nodeType != 1) {
            return [];
        }
        return varyEmpty(el).filter(masterNode);
    },


    /**
     * 内容节点规范化。
     * - 合并相邻文本节点，元素同名Api的简单封装。
     * - level参数是一个告知，说明实际会影响的子孙元素的层级（子元素为1，0表示全部）。
     * - 如果您不理解level参数的用途，简单忽略即可。
     * 说明：
     * - DOM原生normalize接口会处理所有子孙节点，没有办法由用户控制。
     * - 这是一个对DOM树进行修改的接口，因此需要向事件处理器提供信息。
     * - 这里只能设计为由用户主动告知（用于优化）。
     *
     * @param  {Element} el  目标元素
     * @param  {Number} depth 影响的子元素深度
     * @return {Element} 目标元素
     */
    normalize( el, depth = 0 ) {
        if (el.nodeType !== 1) {
            throw new Error(`[${el}] is not a element.`);
        }
        return varyNormalize( el, depth );
    },


    /**
     * 节点克隆。
     * - event/deep/eventdeep参数仅适用于元素节点。
     * - 元素节点默认深层克隆（包含子节点一起）。
     * - 事件处理器也可以克隆，并且可以包含子孙元素的绑定。
     * @param  {Node} node 目标节点/元素
     * @param  {Boolean} event 是否克隆事件处理器
     * @param  {Boolean} deep 节点深层克隆，可选。默认为真
     * @param  {Boolean} eventdeep 是否深层克隆事件处理器（子孙元素），可选
     * @return {Node} 克隆的新节点/元素
     */
    clone( node, event, deep = true, eventdeep = false ) {
        let _new = node.cloneNode(deep);

        if (node.nodeType != 1) {
            return _new;
        }
        return event || eventdeep ? _cloneEvents(node, _new, event, eventdeep) : _new;
    },


    /**
     * 获取/设置垂直滚动条。
     * @param  {Element|Window|Document} el
     * @param  {Number} val
     * @param  {Boolean} inc val是否为增量值（仅限像素）
     * @return {Number|this}
     */
    scrollTop( el, val, inc ) {
        let _win = getWindow(el),
            _old = _win ? _win.pageYOffset : el.scrollTop;

        if ( val === undefined ) {
            return _old;
        }
        if ( inc ) {
            val = +val + _old;
        }
        scrollSet( _win || el, val, _win ? 'Y' : 'T' );

        return this;
    },


    /**
     * 获取/设置水平滚动条。
     * @param  {Element|Window|Document} el
     * @param  {Number} val
     * @param  {Boolean} inc val是否为增量值（仅限像素）
     * @return {Number|this}
     */
    scrollLeft( el, val, inc ) {
        let _win = getWindow(el),
            _old = _win ? _win.pageXOffset : el.scrollLeft;

        if ( val === undefined ) {
            return _old;
        }
        if ( inc ) {
            val = +val + _old;
        }
        scrollSet( _win || el, val, _win ? 'X' : 'L' );

        return this;
    },


    //-- 属性操作 -------------------------------------------------------------


    /**
     * 类名添加。
     * - 支持空格分隔的类名序列。
     * - 支持回调函数获取类名，接口：function([name]):String。
     * @param  {Element} el 目标元素
     * @param  {String|Function} names
     * @return {this}
     */
    addClass( el, names ) {
        if (isFunc(names)) {
            names = names( Arr(el.classList) );
        }
        if (typeof names == 'string') {
            addClass( el, names.trim().split(__reSpace) );
        }
        return this;
    },


    /**
     * 移除类名。
     * - 支持空格分隔的类名序列。
     * - 支持回调函数获取类名，接口：function([name]):String。
     * - 未指定名称移除全部类名（删除class属性）。
     * @param  {Element} el 目标元素
     * @param  {String|Function} names
     * @return {this}
     */
    removeClass( el, names ) {
        if ( isFunc(names) ) {
            names = names( Arr(el.classList) );
        }
        if (names == null) {
            return removeClass(el, names), this;
        }
        if ( typeof names == 'string' ) {
            removeClass( el, names.trim().split(__reSpace) );
        }
        if (el.classList.length == 0) {
            // 清理：不激发attr系事件。
            el.removeAttribute('class');
        }
        return this;
    },


    /**
     * 类名切换。
     * - 支持空格分隔的多个类名。
     * - 支持回调函数获取类名，接口：function([name]):String。
     * - 无参数调用时，操作针对整个类名集。
     * - val也作为整体操作时的强制设定（Boolean）。
     * - 可正确处理SVG元素的class类属性。
     *
     * @param  {Element} el 目标元素
     * @param  {String|Function|Boolean} val 目标值，可选
     * @param  {Boolean} force 强制设定，可选
     * @return {this}
     */
    toggleClass( el, val, force ) {
        if (isFunc(val)) {
            val = val( Arr(el.classList) );
        }
        if (typeof val === 'string') {
            classToggle(el, val.trim().split(__reSpace), force);
        } else {
            classAttrToggle( el, !!val );
        }
        if (el.classList.length == 0) {
            // 清理：不激发attr系事件
            el.removeAttribute('class');
        }
        return this;
    },


    /**
     * 类名匹配检查。
     * 空格分隔的多个类名为And关系。
     * 注：
     * - jQuery中同名方法里空格没有分隔符作用。
     * @param  {Element} el 目标元素
     * @param  {String} names 类名（序列）
     * @return {Boolean}
     */
    hasClass( el, names ) {
        return names.trim().
            split(__reSpace).
            every(
                it => it && el.classList.contains(it)
            );
    },


    /**
     * 获取元素的类名集。
     * 如果没有任何定义，返回一个空串（而非一个空数组）。
     * @param  {Element} el 目标元素
     * @return {[String]|''} 类名集（或空串）
     */
    classAll( el ) {
        if ( el.nodeType != 1 ) {
            window.console.error('el is not a element.');
            return null;
        }
        return el.className && Arr( el.classList );
    },


    /**
     * 特性（Attribute）获取/修改。
     * name: String
     * - "xx"       普通名称
     * - "data-xx"  data系名称
     * - "-xx"      data系名称简写
     * - "text"     针对元素内文本
     * - "html"     针对元素内源码（innerHTML）
     * 注：
     * 仅适用单个特性名。
     * value仅支持简单标量值和取值回调。
     *
     * @param  {Element} el 目标元素
     * @param  {String} name 特性名（单个）
     * @param  {Value|Function|null} value 特性值或取值回调
     * @return {Value|this}
     */
    attr( el, name, value ) {
        name = attrName( name );

        if ( value === undefined ) {
            return customGet( el, name, elemAttr );
        }
        if ( value === null ) {
            removeAttr( el, name );
        } else {
            hookSet( el, name, value, elemAttr );
        }
        return this;
    },


    /**
     * 特性获取/设置（增强版）。
     * names: String
     * - "xx"       普通名称
     * - "aa -val"  名称序列，空格分隔（依然支持data-系简写）
     * - "text"     （同上）
     * - "html"     （同上）
     *
     * 取值：
     * - 条件：value为未定义，name为字符串。
     * - name支持空格分隔多个名称，返回一个键值对象。
     *
     * 设置：
     * - value有值时，name为名称序列（空格分隔），value若为数组则一一对应。
     * - value支持取值回调获取目标值，接口：function(el, name): Value。
     * - value传递null会删除目标特性。
     * - value无值时，name为名值对象或Map，其中值同样支持取值回调。
     *
     * 注记：
     * - Attribute 这里译为特性，表示一开始就固定在源码中的，修改借助于方法。
     * - Property 下面译为属性，表示运行时计算出来的，可直接赋值修改。
     *
     * @param  {Element} el 目标元素
     * @param  {String|Object|Map} names 名称序列或名/值对象
     * @param  {Value|[Value]|Function|null} value 新值（集）或取值回调，可选
     * @return {Value|Object|this}
     */
    attribute( el, names, value ) {
        if ( typeof names == 'string' ) {
            names = names.split(__reSpace).map( n => attrName(n) );
        }
        if ( hookIsGet(names, value) ) {
            return hookGets( el, names, elemAttr );
        }
        if ( value === null ) {
            removeAttrs( el, names );
        } else {
            hookSets( el, names, value, elemAttr );
        }
        return this;
    },


    /**
     * 剪取特性。
     * 取出特性值的同时移除该特性。
     * 注：不包含text和html特殊名。
     * @param  {Element} el 目标元素
     * @param  {String} name 特性名/序列
     * @return {Value|Object} 特性值或值集
     */
    xattr( el, name ) {
        let _its;
        name = name.split(__reSpace)
            .map( n => attrName(n) );

        if ( name.length > 1 ) {
            _its = name.reduce( (o, n) => (o[n] = elemAttr.get(el, n), o), {} );
            removeAttrs( el, name );
        }
        else {
            _its = elemAttr.get( el, name[0] );
            removeAttr( el, name[0] );
        }
        return _its;
    },


    /**
     * 属性（Property）获取/设置。
     * name: String
     * - "xx"   普通名称
     * - "-xx"  data系名称简写
     * - "text" 针对节点文本内容
     * - "html" 针对元素内源码（innerHTML）
     * 注：
     * 仅适用单个特性名。
     * value仅支持简单标量值和取值回调。
     *
     * @param  {Element} el 目标元素
     * @param  {String} name 属性名（单个）
     * @param  {Value|Function|null} value 属性值或取值回调
     * @return {Value|this}
     */
    prop( el, name, value ) {
        return value === undefined ?
            customGet( el, name, elemProp ) :
            hookSet( el, name, value, elemProp ) || this;
    },


    /**
     * 属性获取/设置（增强版）。
     * - 参数说参考.attribute()接口。
     * - 与.attribute()不同，value传递null会赋值为null，可能让元素回到默认状态。
     * @param  {Element} el 目标元素
     * @param  {String|Object|Map} names 名称序列或名/值对象
     * @param  {Value|[Value]|Function|null} value 新值（集）或取值回调，可选
     * @return {Value|Object|this}
     */
    property( el, names, value ) {
        if ( typeof names == 'string' ) {
            names = names.split(__reSpace);
        }
        if ( hookIsGet(names, value) ) {
            return hookGets( el, names, elemProp );
        }
        return hookSets( el, names, value, elemProp ), this;
    },


    /**
     * 删除特性（集）。
     * - 支持空格分隔的名称序列，以及data-系名称的简写。
     * - 支持返回名称序列的取值函数，接口：function(el): String
     * @param  {Element} el 目标元素
     * @param  {String|Function} name 名称/序列
     * @return {this}
     */
    removeAttr( el, name ) {
        if ( isFunc(name) ) {
            name = name(el);
        }
        if ( __reSpace.test(name) ) {
            removeAttrs(
                el,
                name.split(__reSpace).map( n => attrName(n) )
            );
        } else {
            removeAttr( el, attrName(name) );
        }
        return this;
    },


    /**
     * 切换目标特性值。
     * 如果val是一个数组，就在前两个成员间切换。
     * 如果val只是一个值，就在值有无间切换（val|''）。
     * 如果val未定义（null），则在属性有无间切换。
     * 注：
     * 数组形式时以val[0]为对比目标，并不检查val[1]值。
     *
     * @param  {Element} el 目标元素
     * @param  {String} name 特性名
     * @param  {Value|Array2|Function|null} val 切换值获取值回调，可选
     * @return {this}
     */
    toggleAttr( el, name, val ) {
        name = attrName( name );
        let _old = elemAttr.get( el, name );

        if ( isFunc(val) ) {
            val = val( _old, el );
        }
        elemAttr.set( el, name, toggleValue( val, _old ) );

        return this;
    },


    /**
     * 表单控件的取值或设置。
     * 遵循严格的表单提交逻辑：
     * - 未选中的的控件（如单个复选框）不会被提交，取值时返回 null。
     * - disabled 的控件值不会提交，取值时返回 null，设置被忽略。
     * - 无名称（name属性）定义的控件不会提交，取值时返回 undefined。
     * 状态控件：
     * input:radio {
     *      set: 检索同组元素，选中与值匹配的项。
     *      get: 检索同组元素，返回选中的项的值。
     * }
     * input:checkbox {
     *      set: 检索同组元素，匹配项选中，非匹配项取消选中。支持数组参数。
     *           注：单纯的取消选中，传递value为null即可。
     *      get: 检索同组元素，返回选中项的值或值数组（重名时）。
     * }
     * select {
     *      set: 选中同值的option项（清除其它），多选时支持值数组匹配。
     *      get: 获取选中项的值，多选时返回一个数组（无选中时为空）。
     * }
     * 普通控件：
     * _default {
     *      set: 对目标元素的value属性直接赋值。
     *      get: 获取目标元素的value属性值。
     * }
     * 注意：
     * - 只要是同组单选按钮，可以从其中任一控件上获取选中的值。
     * - 重名的复选按钮取值时，从其中任一个控件上都可以取到全部选中项的值。
     * - 选取类控件设置为null时，会清除全部选取（包括 disabled 控件）。
     *
     * @param  {Element} el 目标元素
     * @param  {Value|[Value]|Function} value 匹配测试的值/集或回调
     * @return {Value|[Value]|null|this}
     */
    val( el, value ) {
        let _hook = valHooks[el.type] ||
            valHooks[el.nodeName.toLowerCase()] ||
            valHooks._default;

        if (value === undefined) {
            return _hook.get(el);
        }
        if (isFunc(value)) {
            value = value( _hook.get(el) );
        }
        return _hook.set(el, value), this;
    },


    //-- DOM 文本操作 ---------------------------------------------------------


    /**
     * 提取/设置元素源码。
     * - 禁止脚本类元素 <script>, <style>, <link> 插入。
     * - 会自动移除元素上的脚本类特性：'onerror', 'onload', 'onabort'。
     * - 源数据为节点时，取其outerHTML，多个节点取值串接。
     * - 数据也可为字符串数组或字符串与节点的混合数组。
     * - where值含义详见上Wheres注释。
     * 另：
     * el实参也可为文本，会转义为HTML源码表示，如 < 到 &lt;
     *
     * 取值回调：
     * - 取值函数接收原节点为参数，可返回字符串、节点或节点集。
     * - 返回的节点数据取其outerHTML源码。
     *
     * @param  {Element|String} el 容器元素或待转换文本
     * @param  {String|[String]|Node|[Node]|Function|.values} code 数据源或取值函数，可选
     * @param  {String|Number} where 插入位置，可选（默认填充）
     * @param  {String} sep 多段连接符（设置时），可选（默认空格）
     * @return {String|[Node]} 源码或插入的节点集
     */
    html( el, code, where = '', sep = ' ' ) {
        if (code === undefined) {
            return el.nodeType ? el.innerHTML : htmlCode(el);
        }
        if ( isFunc(code) ) {
            code = code( el );
        }
        if (typeof code == 'object') {
            // maybe null
            code = code && outerHtml(code, sep);
        }
        return Insert(
            el,
            buildFragment(code, el.ownerDocument),
            Wheres[where]
        );
    },


    /**
     * 提取/设置元素文本内容。
     * - 设置时以文本方式插入，HTML源码视为文本。
     * - 源数据为节点时，提取其文本（textContent）插入。
     * - 数据源也可为字符串或节点或其混合的数组。
     * 另：
     * el实参也可为待解析源码，解码为文本表现。如 &lt; 到 <
     *
     * 取值回调：
     * - 取值函数接收原节点为参数，可返回字符串、节点或节点集；
     * - 返回的节点数据取其outerHTML源码；
     *
     * @param  {Element|String} el 容器元素或待解析源码
     * @param  {String|[String]|Node|[Node]|Function|.values} code 数据源或取值函数，可选
     * @param  {String|Number} where 插入位置，可选（默认填充）
     * @param  {String} sep 多段连接符（设置时），可选（默认空格）
     * @return {String|Node} 源码或插入的文本节点
     */
    text( el, code, where = '', sep = ' ' ) {
        if (code === undefined) {
            return el.nodeType ? el.textContent : htmlText(el);
        }
        if ( isFunc(code) ) {
            code = code( el );
        }
        if (typeof code == 'object') {
            code = code && nodeText(code, sep);
        }
        return Insert(
            el,
            el.ownerDocument.createTextNode(code),
            Wheres[where]
        );
    },


    //== CSS 属性 =============================================================
    // height/width
    // innerHeight/innerWidth/outerHeight/outerWidth
    // 定义见后集中设置。


    /**
     * 获取/设置元素样式。
     * 获取为计算后的样式值，设置为内联样式（style）。
     * 设置：
     * - val值支持取值回调，接口：fn.bind(el)( oldval, cso )。
     * - val为空串或null，会删除目标样式。
     * 注记：
     * Edge/Chrome/FF已支持短横线样式属性名。
     *
     * @param  {Element} el 目标元素
     * @param  {String} name 样式名（单个）
     * @param  {Value|Function} val 设置值或取值回调
     * @return {String|this}
     */
    css( el, name, val ) {
        let _cso = getStyles(el);

        if (val === undefined) {
            return _cso[ name ];
        }
        cssSet( el, name, val, _cso );

        if (el.style.cssText.trim() == '') {
            // 清理：不激发attr系事件
            el.removeAttribute('style');
        }
        return this;
    },


    /**
     * 样式获取（增强版）。
     * 多个名称用空格分隔，始终返回一个名/值对对象。。
     * @param  {Element} el 目标元素
     * @param  {String} names 样式名（序列）
     * @return {Object} 样式名/值对对象
     */
    cssGets( el, names ) {
        let _cso = getStyles(el);

        return names.trim()
            .split(__reSpace)
            .reduce( (obj, n) => ( obj[n] = _cso[n], obj ), {} );
    },


    /**
     * 样式设置（增强版）。
     * - name可以为一个键值对象或Map，值依然可以为一个取值回调。
     * - name若为空格分隔的名称序列，val可以为值数组分别一一对应。
     * - name为null可以删除全部的内联样式（即删除style本身)。
     * - val值支持取值回调，接口：fn.bind(el)( oldval, cso )。
     * - val为空串或null，会删除目标样式。
     * @param  {Element} el 目标元素
     * @param  {String|Object|Map|null} names 样式名（序列）或配置对象
     * @param  {Value|[Value]|Function|null} val 样式值
     * @return {this}
     */
    cssSets( el, names, val ) {
        if (names === null) {
            el.removeAttribute('style');
            return this;
        }
        cssSets(el, names, val, getStyles(el));

        if (el.style.cssText.trim() == '') {
            // 清理：不激发attr系事件
            el.removeAttribute('style');
        }
        return this;
    },


    /**
     * 获取/设置元素偏移。
     * - 相对于文档根元素，返回值格式：{top, left}。
     * - 设置值也用同样格式指定。
     * - 传递值为null会清除偏移设置并返回之前的值。
     *
     * @param  {Element} 目标元素
     * @param  {Object|Function|null} pair 配置对象或取值回调
     * @return {Object|this}
     */
    offset( el, pair ) {
        let _cur = getOffset(el);

        if ( !pair ) {
            return pair === null && clearOffset(el) || _cur;
        }
        if ( isFunc(pair) ) {
            pair = pair( _cur );
        }
        pair = useOffset( _cur, pair, calcOffset(el) );
        let _cso = getStyles(el);

        if ( _cso.position == 'static' ) {
            el.style.position = "relative";
        }

        return cssSets(el, pair, null, _cso), this;
    },


    /**
     * 获取相对位置。
     * - 相对于上层含定位属性的元素。
     * - 包含元素外边距（从外边距左上角计算）。
     * - 不处理元素为window/document的情况（同jQuery）。
     * 注记：
     * - 元素相关属性.offsetTop/.offsetLeft未使用（仅工作草案）。
     *   上面的两个属性计算时不包含外边距。
     * @param  {Element} 目标元素
     * @return {Object} {top, left}
     */
    position( el ) {
        let _cso = getStyles(el);

        if (_cso.position == "fixed") {
            // getBoundingClientRect
            // - 参考边框左上角计算，不含外边距；
            // - 此时已与滚动无关；
            return toPosition(el.getBoundingClientRect(), _cso);
        }
        let _cur = getOffset(el),
            _pel = tQuery.offsetParent(el),
            _pot = getOffset(_pel),
            _pcs = getStyles(_pel),
            _new = {
                top:  _cur.top - (_pot ? _pot.top + parseFloat(_pcs.borderTopWidth) : 0),
                left: _cur.left - (_pot ? _pot.left + parseFloat(_pcs.borderLeftWidth) : 0)
            };

        return toPosition(_new, _cso);
    },



    //== 事件接口 =============================================================
    // 事件名支持空格分隔的名称序列。
    // 事件名位置实参支持「事件名:处理器」名值对的配置对象。
    // 用户处理器支持实现了 EventListener 接口的对象（即包含 .handleEvent() 方法）。


    /**
     * 绑定事件处理。
     * 多次绑定同一个事件名和相同的调用函数是有效的。
     * 处理器接口：function( ev, elo ): false|Any
     * ev: Event 原生的事件对象。
     * elo: {
     *      target: Element   事件起源元素（event.target）
     *      current: Element  触发处理器调用的元素（event.currentTarget或slr匹配的元素）
     *      selector: String  委托匹配选择器
     *      delegate: Element 绑定委托的元素（event.currentTarget）
     * }
     * 事件配置对象：{ evn: handle }
     *
     * 注意：
     * - handle如果是EventListener实例，方法.handleEvent()中的this为该实例自身。
     * - handle如果是普通函数，函数内的this没有特殊含义（并不指向ev.currentTarget）。
     *
     * @param  {Element} el 目标元素
     * @param  {String|Object} evn 事件名（序列）或配置对象
     * @param  {String} slr 委托选择器
     * @param  {Function|EventListener|false|null} handle 事件处理器或特殊值
     * @return {this}
     */
    on( el, evn, slr, handle ) {
        if (!evn) {
            return;
        }
        eventBinds(
            'on',
            el,
            slr,
            ...customHandles(evn, handle)
        );
        return this;
    },


    /**
     * 移除事件绑定。
     * 仅能移除 on/one 方式绑定的处理器。
     * slr: {
     *      null        匹配非委托绑定
     *      undefined   匹配非委托绑定和全部委托绑定
     *      ''|false|0  同上undefined
     * }
     * @param  {Element} el 目标元素
     * @param  {String|Object} evn 事件名（序列）或配置对象
     * @param  {String} slr 委托选择器，可选
     * @param  {Function|EventListener|false|null} handle 处理器函数或对象或特殊值，可选
     * @return {this}
     */
    off( el, evn, slr, handle ) {
        if (!evn) {
            evn = '';
        }
        eventBinds(
            'off',
            el,
            slr,
            ...customHandles(evn, handle)
        );
        return this;
    },


    /**
     * 单次绑定。
     * 在事件被触发（然后自动解绑）之前，off 可以移除该绑定。
     * @param  {Element} el 目标元素
     * @param  {String|Object} evn 事件名（序列）或配置对象
     * @param  {String} slr 委托选择器
     * @param  {Function|EventListener|false|null} handle 处理器函数或对象或特殊值
     * @return {this}
     */
    one( el, evn, slr, handle ) {
        if (!evn) {
            return;
        }
        eventBinds(
            'one',
            el,
            slr,
            ...customHandles(evn, handle)
        );
        return this;
    },


    /**
     * 手动事件激发。
     * - evn可以是一个事件名或一个已经构造好的事件对象。
     * - 自定义事件默认不冒泡但可以被取消。
     * - 元素上原生的事件类函数可以直接被激发（如 click, focus）。
     * - 几个可前置on的非事件类方法（submit，load等）可以被激发，但需预先注册绑定。
     *
     * 原生事件激发也可以携带参数，例：
     * trigger(box, scroll, [x, y]) 滚动条滚动到指定位置。
     * 注：
     * 实际上只是简单调用 box.scroll(x, y) 触发scroll事件。
     *
     * 注记：Element.dispatchEvent()返回值：
     * 如果处理器调用了Event.preventDefault()则返回false，否则返回true。
     *
     * @param  {Element} el 目标元素
     * @param  {String|CustomEvent} evn 事件名（单个）或事件对象
     * @param  {Mixed} extra 发送数据，可选
     * @param  {Boolean} bubble 是否冒泡，可选
     * @param  {Boolean} cancelable 是否可取消，可选
     * @return {Boolean} dispatchEvent()接口的返回值。
     */
    trigger( el, evn, extra, bubble = false, cancelable = true ) {
        if (!el || !evn) {
            return;
        }
        if (typeof evn == 'string') {
            if (evn in el && Event.callable(evn)) {
                // 原始参数传递
                el[evn]( ...(isArr(extra) ? extra : [extra]) );
                return this;
            }
            evn = new CustomEvent(evn, {
                detail:     extra,
                bubbles:    !!bubble,
                cancelable: !!cancelable,
            });
        }
        return el.dispatchEvent( evn );
    },

});


// 版本说明。
Reflect.defineProperty(tQuery, 'version', {
    value: version,
    enumerable: false,
});


//
// 简单表格类。
// 表格成员（如行/列）的简单添加或删除等。
// 仅适用规范行列的表格，不支持单元格合并/拆分。
// 不涉及内容操作，需由外部获取内容元素（如单元格）后自行设置。
//
class Table {
    /**
     * 创建表格实例。
     * 不包含表头/脚部分，调用时注意去除表头/脚部分的行计数。
     * rows 若为表格元素，必须至少包含一行（获取列数）。
     * @param  {Number|Element} rows 行数或待封装表格元素
     * @param  {Number} cols 列数
     * @param  {Number} vth 垂直表头单元位置（1|-1）
     * @param  {Document} 所属文档对象，可选
     * @return {Table|Proxy}
     */
    constructor( rows, cols, vth, doc = Doc ) {
        if (rows.nodeType == 1) {
            return Table._build(this, rows);
        }
        let _tbl = doc.createElement('table'),
            _body = _tbl.createTBody();

        this._tbl = _tbl;
        this._vth = vth || null;
        this._cols = cols;

        // 初始为整体逻辑，不激发事件。
        for (let r = 0; r < rows; r++) {
            this._buildTR( _body.insertRow(), 'td' );
        }
    }


    /**
     * 获取/创建或删除表标题。
     * op: {
     *      undefined   返回表标题，不存在则新建
     *      null        删除表标题
     * }
     * @param  {null} op 表标题移除标记
     * @return {Element|null} 表标题元素（可能为null）
     */
    caption( op ) {
        let _cap = this._tbl.caption;

        if ( op === null ) {
            return _cap && varyRemove( _cap, this._tbl );
        }
        return _cap || varyNewNode(
            this._tbl,
            'prepend',
            this._tbl.ownerDocument.createElement( 'caption' )
        );
    }


    /**
     * 获取/删除表体元素。
     * 传递op为null表示删除目标位置的表体元素（并返回之）。
     * 未指定下标时返回表体元素数组。
     * 删除表体元素时必须指定下标位置。
     * @param  {Number} idx 表体元素序号（从0开始）
     * @param  {null} op 删除操作标识，可选
     * @return {Element|[Element]} 表体元素（集）
     */
    bodies( idx, op ) {
        let _bd = this._tbl.tBodies[idx];

        if ( op === null ) {
            return _bd && varyRemove( _bd, this._tbl );
        }
        return idx == null ? Arr(this._tbl.tBodies) : _bd;
    }


    /**
     * 获取/删除表体元素或添加表格行。
     * 简单的无参数调用返回首个表体元素。
     * 传递rows为null会删除首个表体元素或传入的tsec（并返回之）。
     * 添加表格行时会保持列数合法（空单元格）。
     * idx为null|undefined，表示新行插入到末尾。
     * 注：如果缺少表体元素，会自动创建。
     * @param  {Number} rows 行数，可选
     * @param  {Number} idx 插入位置，支持负数从末尾算起，可选
     * @param  {TableSection} tsec 目标<tbody>元素，可选
     * @return {[Element]|Collector} 表体元素集或新添加的行元素集
     */
    body( rows, idx, tsec ) {
        tsec = tsec || this._tbl.tBodies[0];

        if ( rows === null ) {
            return tsec && varyRemove( tsec, this._tbl );
        }
        if ( rows === undefined ) return tsec

        if ( !tsec ) {
            tsec = insertNode(
                this._tbl,
                this._tbl.ownerDocument.createElement( 'tbody' ),
                this._tbl.tFoot
            );
        }
        return this._insertRows( tsec, idx, rows );
    }


    /**
     * 获取/删除表头元素或添加表头行。
     * 无参数调用返回表头元素（可能为null）。
     * 传递rows为null会删除表头元素并返回它（可能为null）。
     * 传递创建参数时，如果不存在表头元素（THead）会新建。
     * rows 实参为null会删除表头元素。
     * idx 支持负数从末尾算起，null|undefined表示末尾之后。
     * @param  {Number|null} rows 行数，可选
     * @param  {Number} idx 插入位置，可选
     * @return {Element|Collector} 表头元素或新添加的行元素集
     */
    head( rows, idx ) {
        let _tsec = this._tbl.tHead;

        if ( rows === null ) {
            return _tsec && varyRemove( _tsec, this._tbl );
        }
        if ( rows === undefined ) return _tsec;

        if ( !_tsec ) {
            _tsec = insertNode(
                this._tbl,
                this._tbl.ownerDocument.createElement( 'thead' ),
                this._tbl.tBodies[0] || this._tbl.tFoot
            );
        }
        return this._insertRows( _tsec, idx, rows, 'th' );
    }


    /**
     * 获取/删除表脚元素或添加表脚行。
     * 简单的无参数调用返回表脚元素（可能为null）。
     * 传递rows为null会删除表脚元素并返回它（可能为null）。
     * 传递创建参数时，如果不存在表脚元素（TFoot）会新建。
     * rows 实参为null会删除表脚元素。
     * idx 支持负数从末尾算起，null|undefined表示末尾之后。
     * @param  {Number|null} rows 行数，可选
     * @param  {Number} idx 插入位置，可选
     * @return {Element|Collector} 表脚元素或新添加的行元素集
     */
    foot( rows, idx ) {
        let _tsec = this._tbl.tFoot;

        if ( rows === null ) {
            return _tsec && varyRemove( _tsec, this._tbl );
        }
        if ( rows === undefined ) return _tsec;

        if ( !_tsec ) {
            _tsec = varyNewNode(
                this._tbl,
                'append',
                this._tbl.ownerDocument.createElement( 'tfoot' )
            );
        }
        return this._insertRows( _tsec, idx, rows );
    }


    /**
     * 获取目标行元素。
     * 如果未指定tsec，表格行计数包含表头和表尾部分。
     * idx 支持负数从末尾算起。
     * @param  {Number} idx 目标行下标
     * @param  {TableSection} tsec 表体区，可选
     * @return {Element|null} 表格行
     */
    get( idx, tsec ) {
        let _rows = (tsec || this._tbl).rows;
        return _rows[ this._index(idx, _rows.length) ] || null;
    }


    /**
     * 获取目标行集。
     * 如果未指定tsec，表格行计数指整个表格（thead/tbody/tfoot）。
     * idx 支持负数从末尾算起。
     * @param  {Number} idx 起始位置
     * @param  {Number} count 获取行数（null|undefined表示全部），可选
     * @param  {TableSection} tsec 表体区，可选
     * @return {Collector} 行元素集
     */
    gets( idx, count, tsec ) {
        let _rows = (tsec || this._tbl).rows;

        idx = this._index( idx, _rows.length );
        count = this._count( idx, _rows.length, count );

        return new Collector(
            [...rangeNumber(idx, count)].map( i => _rows[i] )
        );
    }


    /**
     * 删除单个表格行。
     * idx 支持负数从末尾算起。
     * @param  {Number} idx 目标位置下标
     * @param  {TableSection} tsec 表体区，可选
     * @return {Element|null} 删除的行元素
     */
    remove( idx, tsec ) {
        let _tr = this.get( idx, tsec );
        return _tr && varyRemove( _tr, _tr.parentElement );
    }


    /**
     * 删除多个表格行。
     * 如果未指定tsec，行计数指整个表格（thead/tbody/tfoot）。
     * idx 支持负数从末尾算起。
     * count 为null|undefined表示起始位置之后全部。
     * count 计数大于剩余行数，取剩余行数（容错超出范围）。
     * @param  {Number} idx 起始位置（从0开始）
     * @param  {Number} count 删除数量
     * @param  {TableSection} tsec 表体区，可选
     * @return {Collector} 删除的行元素集
     */
    removes( idx, count, tsec ) {
        tsec = tsec || this._tbl;
        return varyRemoves( this.gets(idx, count, tsec), tsec );
    }


    /**
     * 插入一列。
     * 在下标位置前插（新列即在下标位置）。
     * idx 支持负值从末尾算起。
     * 传递idx为null|undefined表示插入到末尾之后。
     * 注：表格必须有参考列（即至少已有1列）。
     * @param  {Number} idx 下标位置，可选
     * @return {Collector} 新插入的列单元格集
     */
    insertColumn( idx ) {
        let _buf = [];
        idx = this._index( idx, this._cols );

        for (const tr of this._tbl.rows) {
            let _ref = tr.cells[idx],
                _tag = this._cellTag(tr);
            _buf.push(
                insertNode( tr, this._columnCell(_ref, tr.cells[idx-1], _tag), _ref )
            );
        }
        this._cols += 1;

        return new Collector( _buf );
    }


    /**
     * 插入多列。
     * idx 支持负值从末尾算起。
     * 传递idx为null|undefined表示插入到末尾之后。
     * @param  {Number} cols 新列数量
     * @param  {Number} idx 列下标位置，可选
     * @return {Collector} 新插入的列单元格数组集（二维）
     */
    insertColumns( cols, idx ) {
        let _buf = [];
        idx = this._index( idx, this._tbl.rows[0].cells.length );

        for (const tr of this._tbl.rows) {
            let _ref = tr.cells[idx],
                _tag = this._cellTag(tr);
            _buf.push(
                insertNodes( tr, this._newCells(_ref, tr.cells[idx-1], cols, _tag), _ref )
            );
        }
        this._cols += cols;

        return new Collector( _buf );
    }


    /**
     * 删除一列。
     * idx 支持负值从末尾算起。
     * @param  {Number} idx 位置下标
     * @return {Collector} 删除的列单元格集
     */
    removeColumn( idx ) {
        let _buf = [];
        idx = this._index( idx, this._cols );

        if ( idx < this._cols ) {
            for (const tr of this._tbl.rows) {
                _buf.push( varyRemove(tr.cells[idx], tr) );
            }
        }
        this._cols -= 1;

        return new Collector( _buf );
    }


    /**
     * 删除多列。
     * idx 支持负值从末尾算起。
     * cols 未传递（undefined）或超出范围，会删除到末尾。
     * 注：若未实际删除内容，返回集的成员将全部为空数组。
     * @param  {Number} idx 起始位置下标
     * @param  {Number} cols 待删除的列数，可选
     * @return {Collector} 删除的列单元格数组集
     */
    removeColumns( idx, cols ) {
        let _buf = [],
            _max = this._tbl.rows[0].cells.length;

        idx = this._index( idx, _max );
        cols = this._count( idx, _max, cols );

        for (const tr of this._tbl.rows) {
            _buf.push(
                varyRemoves( this._columnCells(tr, idx, cols), tr )
            );
        }
        this._cols -= cols;

        return new Collector( _buf );
    }


    /**
     * 返回表格目标区的行数。
     * 未指定实参时计数针对整个表格。
     * @param  {TableSection} 表格目标区，可选
     * @return {Number}
     */
    rows( tsec ) {
        return (tsec || this._tbl).rows.length;
    }


    /**
     * 返回表格的列数。
     * @return {Number}
     */
    columns() {
        return this._cols;
    }


    /**
     * 创建并插入一个新的<tbody>元素。
     * 注：一个表格中允许多个<tbody>（可模拟分片效果）。
     * @return {Element} 新建的<tbody>
     */
    newBody() {
        return this._tbl.createTBody();
    }


    /**
     * 列表头位置。
     * @return {Number|null}
     */
    hasVth() {
        return this._vth;
    }


    /**
     * 返回原始的表格元素。
     * @return {Element}
     */
    element() {
        return this._tbl;
    }


    //-- 私有辅助 -------------------------------------------------------------


    /**
     * 构建表格行。
     * 仅包含空的单元格（内容赋值由外部处理）。
     * @param  {Element} tr 表格行容器（空）
     * @param  {String} tag 单元格标签名，可选
     * @return {Element} tr 原表格行
     */
     _buildTR( tr, tag, doc = tr.ownerDocument ) {
        if ( this._cols > 0 ) {
            // 整体逻辑，不激发事件。
            tr.append( ...this._rowCells(this._cols, this._vth, tag, doc) );
        }
        return tr;
    }


    /**
     * 插入表格行。
     * 保持合法的列数，全部为空单元格。
     * 可适用表格行已被全部删除后的情况。
     * @param  {TableSection} sect 表格区域（TBody|THead|TFoot）
     * @param  {Number} idx 插入位置（>=0）
     * @param  {Number} rows 插入行数
     * @param  {String} tag 主要单元格名称
     * @return {Collector} 新插入的行元素（集）
     */
    _insertRows( sect, idx, rows = 1, tag = 'td', doc = sect.ownerDocument ) {
        idx = this._index(idx, sect.rows.length);
        let _buf = [];

        for (let r = 0; r < rows; r++) {
            _buf.push(
                this._buildTR( doc.createElement('tr'), tag )
            );
        }
        // 行集作为一个整体插入/激发事件。
        return new Collector( insertNodes(sect, _buf, sect.rows[idx]) );
    }


    /**
     * 创建一个列单元格。
     * 注：可能已经没有表格列（全部空<tr>）。
     * @param  {Element} ref 参考单元格
     * @param  {Element} prev 参考单元格前一个单元格
     * @param  {String} tag 单元格标签名（th|td）
     * @return {Element}
     */
    _columnCell( ref, prev, tag ) {
        ref = ref || prev;

        if ( ref ) {
            return ref.cloneNode();
        }
        return this._tbl.ownerDocument.createElement( this._vth ? 'th' : tag );
    }


    /**
     * 创建列单元格集（行段）。
     * 新单元格参考目标位置的单元格创建（同类）。
     * 末尾列参考原末尾列单元格创建。
     * @param  {Element} ref 参考单元格
     * @param  {Element} prev 参考单元格前一个单元格
     * @param  {Number} cols 列数（段长度）
     * @param  {String} tag 单元格标签名（th|td）
     * @return {[Element]}
     */
    _newCells( ref, prev, cols, tag ) {
        ref = ref || prev;

        if ( !ref ) {
            return this._rowCells( cols, this._vth, tag, this._tbl.ownerDocument );
        }
        let _buf = [];

        for (let i = 0; i < cols; i++) {
            _buf.push( ref.cloneNode() );
        }
        return _buf;
    }


    /**
     * 新建一行单元格（集）。
     * @param  {Number} cols 列数
     * @param  {Number} vth 列表头位置（1|-1）
     * @param  {String} tag 单元格标签名（th|td）
     * @param  {Document} doc 所属文档对象
     * @return {[Element]}
     */
    _rowCells( cols, vth, tag, doc ) {
        let _buf = [];

        for (let i = 0; i < cols-1; i++) {
            _buf.push( doc.createElement(tag) );
        }
        return insertVth( vth, _buf, doc );
    }


    /**
     * 获取连续单元格段。
     * 注：idx已与size正确匹配（idx溢出时size为0）。
     * @param  {Element} tr 表格行
     * @param  {Number} idx 目标位置
     * @param  {Number} size 删除数量
     * @return {[Element]} 被删除的单元格集
     */
    _columnCells( tr, idx, size ) {
        let _buf = [];

        for (let i = 0; i < size; i++) {
            _buf.push( tr.cells[idx++] );
        }
        return _buf;
    }


    /**
     * 检查获取单元格标签名。
     * 用户可能错误地插入多个<thead>，但容错（依然为<th>）。
     * @param  {Element} tr 表格行
     * @return {String}
     */
    _cellTag( tr ) {
        return this._tbl.tHead &&
            tr.parentNode.nodeName === 'THEAD' ? 'th' : 'td';
    }


    /**
     * 计算合法的下标值。
     * idx:
     * - 支持负值从末尾算起（-1为最末一行）。
     * - null值或超出max时，视为max本身。
     * @param  {Number} idx 位置下标
     * @param  {Number} max 最多行/列数限制
     * @return {Number}
     */
    _index( idx, max ) {
        if ( idx < 0 ) {
            idx += max;
        }
        return idx == null || idx < 0 || idx > max ? max : idx;
    }


    /**
     * 计算合法的行数（或列数）。
     * idx 已为正数有效值。
     * count 如果未指定表示后续全部。
     * @param  {Number} idx 起点位置
     * @param  {Number} max 最多行/列数限制
     * @param  {Number} count 获取行/列数，可选
     * @return {Number}
     */
    _count( idx, max, count ) {
        let _sz = max - idx;

        if ( count == null ) {
            return _sz;
        }
        return count >= 0 && count < _sz ? count : _sz;
    }


    /**
     * 删除目标行。
     * 假设idx参数已合法。
     * @param  {Number} idx 目标位置
     * @param  {TableSection} tsec 表体区
     * @return {Element} 删除的元素
     */
    _remove( idx, tsec ) {
        let _row = tsec.rows[idx];
        tsec.deleteRow(idx);
        return _row;
    }

}


//
// 构建Table实例。
// 传入的tbl实参必须是一个表格元素且至少包含一行。
// @param  {Table} self 一个空实例
// @param  {Element} tbl 表格元素
// @return {Table}
//
Table._build = function( self, tbl ) {
    if ( tbl.rows.length == 0 ) {
        return null;
    }
    self._cols = tbl.rows[0].cells.length;
    self._vth = whereVth( tbl.tBodies[0].rows[0] || tbl.tFoot.rows[0] );
    self._tbl = tbl;

    return self;
}


//
// 导出供外部复用（如继承）。
//
tQuery.Table = Table;


//
// 6种插入方式。
// 数据源仅为节点类型，不支持字符串源码。
///////////////////////////////////////
[
    'before',
    'after',
    'prepend',
    'append',
    'replace',  //jQuery: replaceWith
    'fill',     //jQuery: html(elem)
]
.forEach(function( name ) {
    /**
     * 在元素的相应位置添加节点（集）。
     * - 数据源仅支持节点（集），不支持html字符串。
     * - 仅元素适用于事件克隆（event系列）。
     * - 数据集成员容错假值忽略。
     * - 文本节点不适用内部插入方法
     * 取值回调：
     * - 取值函数接受原节点作为参数。
     * - 取值函数可返回节点或任意类型节点集（不能是字符串）。
     *
     * @param  {Node} el 目标元素或文本节点
     * @param  {Node|DocumentFragment|[Node]|Collector|Set|Iterator|Function} cons 数据节点（集）或回调
     * @param  {Boolean} clone 数据节点克隆
     * @param  {Boolean} event 是否克隆事件处理器（容器）
     * @param  {Boolean} eventdeep 是否深层克隆事件处理器（子孙元素）
     * @return {Node|[Node]|Error} 新插入的节点（集）
     */
    tQuery[name] = function( el, cons, clone, event, eventdeep ) {
        let _meth = Wheres[name];

        if ( isFunc(cons) ) {
            cons = cons(el);
        }
        return Insert( el, clone ? nodesClone(cons, event, eventdeep) : nodesItem(cons), _meth );
    };
});


//
// 数值尺寸设置/取值（Float）
// height/width
///////////////////////////////////////
[
    ['height',  'Height'],
    ['width',   'Width'],
]
.forEach(function( its ) {
    let _n = its[0];
    /**
     * 获取/设置元素的高宽度。
     * - 始终针对内容部分（不管box-sizing）。
     * - 设置值可包含任意单位，纯数值视为像素单位。
     * - 传递val为null或一个空串会删除样式（与.css保持一致）。
     * - 获取时返回数值。便于数学计算。
     * 注记：
     * box-sizing {
     *      content-box: css:height = con-height（默认）
     *      border-box:  css:height = con-height + padding + border
     * }
     * @param  {Element|Document|Window} el 目标元素
     * @param  {String|Number|Function} val 设置值
     * @param  {Boolean} inc val是否为增量值（仅限像素）
     * @return {Number|this}
     */
    tQuery[_n] = function( el, val, inc ) {
        let _h = _rectWin(el, its[1], 'inner') || _rectDoc(el, its[1]) || _elemRect(el, _n);

        if ( val === undefined ) {
            return _h;
        }
        if ( isFunc(val) ) {
            val = val.bind(el)(_h);
        }
        if ( inc ) {
            val = +val + _h;
        }
        _elemRectSet( el, _n, val );

        if ( el.style.cssText.trim() == '' ) {
            // 内部清理，不激发事件。
            el.removeAttribute('style');
        }
        return this;
    };
});


//
// 内高宽取值（Float）
// innerHeight/innerWidth
// 注：包含padding，但不包含border。
///////////////////////////////////////
[
    ['Height',  'inner'],
    ['Width',   'inner'],
]
.forEach(function( its ) {
    let _t = its[0].toLowerCase(),
        _n = its[1] + its[0];
    /**
     * @param  {Element|Document|Window} el 目标元素
     * @return {Number}
     */
    tQuery[_n] = function( el ) {
        return _rectWin(el, its[0], its[1]) || _rectDoc(el, its[0]) || _rectElem(el, _t, _n);
    };
});


//
// 外高宽取值（Float）
// outerHeight/outerWidth
// 注：注：包含border，可选的包含margin。
///////////////////////////////////////
[
    ['Height',  'outer'],
    ['Width',   'outer'],
]
.forEach(function( its ) {
    let _t = its[0].toLowerCase(),
        _n = its[1] + its[0];
    /**
     * @param  {Element|Document|Window} el 目标元素
     * @param  {Boolean} margin 是否包含外边距
     * @return {Number}
     */
    tQuery[_n] = function( el, margin ) {
        return _rectWin(el, its[0], its[1]) || _rectDoc(el, its[0]) || _rectElem(el, _t, _n, margin);
    };
});


//
// 可调用原生方法（事件类）。
///////////////////////////////////////

callableNative
.forEach(
    name =>
    tQuery[name] = function( el ) {
        return (name in el) && el[name](), this;
    }
);


/**
 * 滚动方法定制。
 * 包含无参数调用返回滚动条的位置对象：{top, left}。
 * 传递实参时调用原生滚动方法（会触发滚动事件）。
 * pair可以是一个配置对象，也可以是一个水平/垂直坐标的二元数组。
 * @param  {Element} el 包含滚动条的容器元素
 * @param  {Object2|[left, top]} pair 滚动位置配置对象。
 * @return {Object2|this}
 */
tQuery.scroll = function( el, pair ) {
    if ( pair === undefined ) {
        return {
            top: tQuery.scrollTop(el),
            left: tQuery.scrollLeft(el)
        };
    }
    return ( isArr(pair) ? el.scroll(...pair) : el.scroll(pair) ), this;
}


/**
 * 获取窗口尺寸。
 * 注意！
 * - 这与浏览器原生的innerXXX/outerXXX逻辑不同。
 * - innerXXX 表示内容部分，不含滚动条。
 * - outerXXX 只是包含了滚动条的内容部分，而不是浏览器窗口本身。
 * 注：这与 jQuery 的逻辑一致。
 * @param  {Window} el   获取目标
 * @param  {String} name 尺寸名称（Height|Width）
 * @param  {String} type 取值类型（inner|outer）
 * @return {Number|false}
 */
function _rectWin( el, name, type ) {
    return isWindow(el) && (
        type == 'outer' ?
        el[ `inner${name}` ] :
        el.document.documentElement[ `client${name}` ]
    );
}


/**
 * 获取文档尺寸。
 * scroll[Width/Height] or offset[Width/Height] or client[Width/Height]
 * 最大者。
 * @param  {Document} el 获取目标
 * @param  {String} name 尺寸名称（Height|Width）
 * @return {Number|undefined}
 */
function _rectDoc( el, name ) {
    if (el.nodeType != 9) {
        return;
    }
    let _html = el.documentElement;

    return Math.max(
        el.body[ `scroll${name}` ], _html[ `scroll${name}` ],
        el.body[ `offset${name}` ], _html[ `offset${name}` ],
        _html[ `client${name}` ]
    );
}


/**
 * 获取元素尺寸。
 * （innerHeight/innerWidth）
 * （outerHeight/outerWidth）
 * @param  {Window} el   获取目标
 * @param  {String} type 取值类型（height|width）
 * @param  {String} name 取值名称
 * @return {Number|false}
 */
function _rectElem( el, type, name, margin ) {
    let _cso = getStyles(el);
    return boxSizing[ _cso.boxSizing ].get(el, type, name, _cso, margin);
}


/**
 * 获取元素尺寸（height/width）。
 * @param  {Element} el  目标元素
 * @param  {String} name 尺寸名称（height|width）
 * @return {Number}
 */
function _elemRect( el, name ) {
    let _cso = getStyles(el);
    return boxSizing[ _cso.boxSizing ].get(el, name, name, _cso);
}


/**
 * 设置元素尺寸（height|width）。
 * - 支持非像素单位设置。
 * @param  {Element} el  目标元素
 * @param  {String} name 设置类型/名称
 * @param  {String|Number} val 尺寸值
 * @return {Number}
 */
function _elemRectSet( el, name, val ) {
    let _cso = getStyles(el),
        _inc = boxSizing[ _cso.boxSizing ].set(el, name, val, _cso);

    // 非像素设置时微调
    if (_inc) el.style[name] = parseFloat(_cso[name]) + _inc + 'px';
}


/**
 * 获取兄弟元素。
 * 仅检查相邻元素，不匹配时返回null。
 * @param  {String|Function} slr 选择器或匹配测试函数，可选
 * @param  {String} dir 方向（nextElementSibling|previousElementSibling）
 * @return {Element|null}
 */
function _sibling( el, slr, dir ) {
    let _ne = el[dir];
    return getFltr(slr)(_ne, 1) ? _ne : null;
}


/**
 * 获取兄弟元素。
 * 会持续迭代直到匹配或抵达末端。
 * @param  {String|Function} slr 选择器或匹配测试函数，可选
 * @param  {String} dir 方向（nextElementSibling|previousElementSibling）
 * @return {Element|null}
 */
function _sibling2( el, slr, dir ) {
    let _fun = getFltr(slr),
        _i = 0;

    while ( (el = el[dir]) ) {
        if ( _fun(el, ++_i) ) return el;
    }
    return null;
}

/**
 * dir方向全部兄弟。
 * 可选的用slr进行匹配过滤。
 * @param  {String|Function} slr 匹配选择器，可选
 * @param  {String} dir 方向（同上）
 * @return {Array}
 */
function _siblingAll( el, slr, dir ) {
    let _els = [],
        _fun = getFltr( slr ),
        _i = 0;

    while ( (el = el[dir]) ) {
        if ( _fun(el, ++_i) ) _els.push(el);
    }
    return _els;
}


/**
 * dir方向兄弟元素...直到。
 * 获取dir方向全部兄弟元素，直到slr但不包含。
 * @param  {String|Element|Function} slr 终止判断，可选
 * @param  {String} dir 方向（同上）
 * @return {Array}
 */
function _siblingUntil( el, slr, dir ) {
    let _els = [],
        _fun = getFltr( slr ),
        _i = 0;

    while ( (el = el[dir]) ) {
        if ( _fun(el, ++_i) ) break;
        _els.push(el);
    }
    return _els;
}


/**
 * 返回首个匹配的元素。
 * 测试匹配函数接口：function(el): Boolean
 * @param  {[Element]} els 元素集（数组）
 * @param  {String|Element|Function} slr 选择器或匹配测试
 * @return {Element|null}
 */
function _first( els, slr, beg = 0, step = 1 ) {
    let _fun = slr,
        _cnt = els.length;

    if ( !isFunc(_fun) ) {
        _fun = el => $is(el, slr);
    }
    while ( _cnt-- ) {
        if ( _fun(els[beg]) ) return els[beg];
        beg += step;
    }
    return null;
}


/**
 * 元素事件克隆。
 * 源保证：to必须是src克隆的结果。
 * @param  {Element} src 源元素
 * @param  {Element} to  目标元素
 * @param  {Boolean} top 根级克隆
 * @param  {Boolean} deep 是否深层克隆
 * @return {Element} 目标元素
 */
function _cloneEvents( src, to, top, deep ) {
    if (top) {
        Event.clone(to, src);
    }
    if (!deep || src.childElementCount == 0) {
        return to;
    }
    let _to = $tag('*', to),
        _src = $tag('*', src);

    for (let i = 0; i < _src.length; i++) {
        Event.clone( _to[i], _src[i] );
    }
    return to;
}



//
// 元素收集器。
// 继承自数组，部分数组的函数被重定义，但大部分保留。
//
class Collector extends Array {
    /**
     * 构造收集器实例。
     * @param {Node|NodeList|Array|Window|Value} obj 节点或值（集）
     * @param {Collector} prev 前一个实例引用
     */
    constructor( obj, prev ) {
        super();
        // window.console.info(obj);
        this.push(...arrayArgs(obj));
        this.previous = prev || null;
    }


    //
    // 衍生对象直接上层构造。
    // 如：.map() .filter() 等。
    //
    static get [Symbol.species]() { return Array; }


    //-- 重载父类方法 ---------------------------------------------------------
    // 注：便于链栈操作。


    /**
     * 片段提取构建子集。
     * @param  {Number} beg 起始下标
     * @param  {Number} end 终点下标（不含）
     * @return {Collector}
     */
    slice( beg, end ) {
        return new Collector( super.slice(beg, end), this );
    }


    /**
     * 数组连接。
     * 注：不会自动去重排序。
     * @param  {Value|[Value]} rest 待连接成员（数组）
     * @return {Collector}
     */
    concat( ...rest ) {
        return new Collector( super.concat(...rest), this );
    }


    /**
     * 父类覆盖。
     * 支持内部的实例链栈。
     * @param  {Function} proc 回调函数
     * @return {Collector}
     */
    map( proc ) {
        return new Collector( super.map(proc), this );
    }


    /**
     * 排序覆盖。
     * - comp为null以获得默认的排序规则（非元素支持）。
     * - 总是会返回一个新的实例。
     * @param  {Function|null} comp 排序函数，可选
     * @return {Collector}
     */
    sort( comp = sortElements ) {
        // 新数组上排序。
        return new Collector( Arr(this).sort(comp || undefined), this );
    }


    /**
     * 集合成员顺序逆转。
     * 在一个新集合上逆转，保持链栈上的可回溯性。
     * @return {Collector}
     */
    reverse() {
        return new Collector( Arr(this).reverse(), this );
    }


    /**
     * 集合扁平化。
     * deep:
     * - Number 扁平化深度，适用原生支持的环境
     * - true   节点集去重排序
     * 注记：
     * 标准接口中返回的集合都只有1级子数组。数值深度可用于普通的值集。
     *
     * @param  {Number|true} deep 深度值或去重排序指示
     * @return {Collector}
     */
    flat( deep = 1 ) {
        let _els = super.flat ?
            super.flat( deep ) : arrFlat(this);

        return new Collector( deep === true ? uniqueSort(_els, sortElements) : _els, this );
    }


    //-- 集合过滤 -------------------------------------------------------------
    // 空集返回空集本身，不会增长栈链。


    /**
     * 匹配过滤（通用）。
     * 支持任意值的集合。
     * fltr为过滤条件：
     * - String:   作为元素的CSS选择器，集合内成员必须是元素。
     * - Array:    集合内成员在数组内，值任意。注：集合的交集。
     * - Function: 自定义测试函数，接口：function(Value, Index, this): Boolean。
     * - Value:    任意其它类型的值，相等即为匹配（===）。
     * @param  {String|Array|Function|Value} fltr 匹配条件
     * @return {Collector} 过滤后的集合
     */
    filter( fltr ) {
        if ( this.length == 0 ) {
            return this;
        }
        return new Collector( super.filter( getFltr(fltr) ), this );
    }


    /**
     * 排除过滤（通用）。
     * - 从集合中移除匹配的元素。
     * - 自定义测试函数接口同上。
     * @param  {String|Array|Function|Value} fltr 排除条件
     * @return {Collector}
     */
    not( fltr ) {
        if ( this.length == 0 ) {
            return this;
        }
        let _fun = getFltr( fltr );

        return new Collector(
            super.filter( (v, i, o) => !_fun(v, i, o) ),
            this
        );
    }


    /**
     * 元素包含过滤。
     * 检查集合中元素的子级元素是否可与目标（选择器）匹配。
     * 注：仅支持由元素构成的集合。
     * @param  {String|Element} slr 测试目标
     * @return {Collector}
     */
    has( slr ) {
        if ( this.length == 0 ) {
            return this;
        }
        return new Collector( super.filter( hasFltr(slr) ), this );
    }


    //-- 定制部分 -------------------------------------------------------------


    /**
     * 在集合内的每一个元素中查询单个目标。
     * 注意父子关系的元素可能获取到重复的元素。
     * 如果all为真，未找到的返回值（null）保留。
     * @param  {String} slr 选择器
     * @param  {Boolean} all 全部保留
     * @return {Collector}
     */
    get( slr, all ) {
        let _els = Arr(this)
            .map(el => tQuery.get(slr, el));

        return new Collector( all ? _els : _els.filter(e => e), this );
    }


    /**
     * 查找匹配的元素集。
     * 注：返回值是单元素版find结果的数组（二维）。
     * @param  {String} slr 选择器
     * @param  {Boolean} andOwn 包含上下文自身匹配
     * @return {Collector}
     */
    find( slr, andOwn ) {
        let _buf = this.map(
                el => tQuery.find(slr, el, andOwn)
            );
        return new Collector( _buf, this );
    }


    /**
     * 移除节点集（从DOM中）。
     * - 匹配选择器 slr 的会被删除。
     * - 被移除的节点会作为一个新集合返回。
     * @param  {String|Function} slr 过滤选择器
     * @return {Collector} 被移除的节点集
     */
    remove( slr ) {
        let _fun = getFltr( slr ),
            _els = super.filter(
                (e, i, o) => _fun(e, i, o) ? tQuery.remove(e) : false
            );
        return new Collector( _els, this );
    }


    /**
    /**
     * 移除同级节点集（从DOM中）。
     * 被移除的成员会作为一个新集合返回。
     * 注意：
     * 集合成员或筛选出的集合成员必须为同级兄弟节点。
     * 这是对节点变化触发事件的优化。
     * @param  {String|Function} slr 过滤选择器
     * @return {Collector} 移除的集的集
     */
    removeSiblings( slr ) {
        let _els = slr ?
            super.filter( getFltr(slr) ) :
            this;
        return new Collector( varyRemoves( _els, _els[0].parentElement ), this );
    }


    /**
     * 剪取元素特性。
     * 支持名称数组与集合成员一一对应。
     * 名称（成员）本身可以是空格分隔的名称序列。
     * @param  {String|[String]} name 名称/序列
     * @return {Collector}
     */
    xattr( name ) {
        if ( !isArr(name) ) {
            return this.map( el => tQuery.xattr(el, name) );
        }
        return new Collector(
            cleanMap( this, (e, i) => name[i] && tQuery.xattr(el, name[i]) ),
            this
        );
    }


    /**
     * 样式设置（高级版）。
     * 支持名称数组/值数组和元素集成员一一对应。
     * @param {String|[String|Object|Map]} name 样式名/序列（集）
     * @param {Value|[Value]} val 样式值
     */
    cssSets( name, val ) {
        _customSets(
            'cssSets', this, name, val, isArr(name)
        );
        return this;
    }


    /**
     * 去重&排序。
     * comp无实参传递时仅去重（无排序）。
     * comp: {
     *      true  DOM节点元素类排序
     *      null  重置为默认排序规则，用于非元素类
     * }
     * @param  {Function|null|true} comp 排序函数
     * @return {Collector}
     */
    unique( comp ) {
        return new Collector(
            uniqueSort( this, comp === true ? sortElements : comp ),
            this
        );
    }


    /**
     * 迭代回调。
     * - 对集合内每一个元素应用回调（el, i, this）；
     * @param  {Function} handle 回调函数
     * @param  {Object} thisObj 回调函数内的this
     * @return {Collector} this
     */
    each( handle, thisObj ) {
        return tQuery.each( this, handle, thisObj );
    }


    //-- 集合/栈操作 ----------------------------------------------------------


    /**
     * 用一个容器包裹集合里的全部节点。
     * - 目标容器可以是一个元素或HTML结构字符串。
     * - 如果容器是由HTML构建而成且包含子元素，最终的包裹元素会递进到首个最深层子元素。
     * - 目标容器会替换集合中首个节点的位置。
     * 注：
     * 集合内成员仅支持节点类型。
     * 空集不会有任何操作且返回空集自身，而不是容器的Collector封装。
     *
     * @param  {Element|String} box 目标容器
     * @param  {Boolean} clone 容器元素是否克隆，可选
     * @param  {Boolean} event 容器元素上的事件绑定是否克隆，可选
     * @param  {Boolean} eventdeep 容器子孙元素上的事件绑定是否克隆，可选
     * @return {Collector} 包裹容器或空集自身
     */
    wrapAll( box, clone, event, eventdeep ) {
        if ( this.length == 0 ) {
            return this;
        }
        let [_box, _root] = wrapBox(
                box, clone, event, eventdeep, this[0].ownerDocument
            );
        return new Collector( varyWrapAll(_root || _box, _box, this), this );
    }


    /**
     * 获取集合内单元。
     * - 获取特定下标位置的元素，支持负数倒数计算。
     * - 未指定下标返回整个集合的一个普通数组表示。
     * 注：兼容字符串数字，但空串不为0。
     * @param  {Number} idx 下标值，支持负数
     * @return {Value|[Value]}
     */
    item( idx ) {
        return idx ? indexItem(this, +idx) : ( idx === 0 ? this[0] : Arr(this) );
    }


    /**
     * 用特定下标的成员构造一个新实例。
     * - 下标超出集合大小时构造一个空集合。
     * - 支持负下标从末尾算起。
     * 注：兼容字符串数字，但空串不为0。
     * @param  {Number} idx 下标值，支持负数
     * @return {Collector}
     */
    eq( idx ) {
        if ( !idx ) idx = 0;
        return new Collector( indexItem(this, +idx), this );
    }


    /**
     * 用集合的首个匹配成员构造一个新集合。
     * 取值接口：function( Element ): Boolean
     * 注：如果当前集合已为空，返回当前空集合。
     * @param  {String|Element|Function} slr 匹配选择器
     * @return {Collector}
     */
    first( slr ) {
        if (this.length == 0) {
            return this;
        }
        return new Collector( (slr ? _first(this, slr) : this[0]), this );
    }


    /**
     * 用集合的最后一个匹配成员构造一个新集合。
     * 取值接口：function( Element ): Boolean
     * 注：如果当前集合已为空，返回当前空集合。
     * @param  {String|Element|Function} slr 匹配选择器
     * @return {Collector}
     */
    last( slr ) {
        let _len = this.length;

        if (_len == 0) {
            return this;
        }
        return new Collector( (slr ? _first(this, slr, _len-1, -1) : this[_len-1]), this );
    }


    /**
     * 添加新元素。
     * - 返回一个添加了新成员的新集合。
     * - 总是会构造一个新的实例返回（同jQuery）。
     * 注：unique参数仅用于DOM节点集。
     * @param  {String|Node|[Node]|Collector|Value|[Value]} its 目标内容
     * @param  {Boolean} unique 是否去重排序
     * @return {Collector}
     */
    add( its, unique ) {
        let _els = super.concat( tQuery(its) );
        return new Collector( unique ? uniqueSort(_els, sortElements) : _els, this );
    }


    /**
     * 构造上一个集合和当前集合的新集合。
     * - 可选的选择器用于在上一个集合中进行筛选。
     * - 总是会返回一个新实例，即便加入集为空。
     * 注：unique参数仅用于DOM节点集。
     * @param  {String|Function} slr 选择器或过滤函数
     * @param  {Boolean} unique 是否去重排序
     * @return {Collector}
     */
    addBack( slr, unique ) {
        let _els = this.previous;

        if ( !_els ) {
            return new Collector( null, this );
        }
        _els = super.concat( slr ? _els.filter(slr) : _els );

        return new Collector( unique ? uniqueSort(_els, sortElements) : _els, this );
    }


    /**
     * 返回集合链栈末尾第n个集合。
     * - 0值表示末端的当前集。
     * - 传递任意负值返回起始集。
     * @param  {Number} n 回溯的层数
     * @return {Collector}
     */
    end( n = 1) {
        let _it = this, _c0;

        while ( n-- && _it ) {
            _c0 = _it;
            _it = _it.previous;
        }
        return n < -1 ? _c0 : _it;
    }

}


// 已封装标志。
Reflect.defineProperty(Collector.prototype, ownerToken, {
    value: true,
    enumerable: false,
});


/**
 * Collector 取节点方法集成。
 * 获取的节点集入栈，返回一个新实例。
 * - 由 tQuery.xx 单元素版扩展到 Collector 原型空间。
 * - 仅用于 tQuery.xx 返回节点（集）的调用。
 * @param  {Array} list 定义名清单（方法）
 * @param  {Function} get 获取元素句柄
 * @return {Collector} 目标节点集
 */
function elsEx( list, get ) {
    list
    .forEach(function( fn ) {
        Reflect.defineProperty(Collector.prototype, fn, {
            value: function(...rest) {
                return new Collector( get(fn, this, ...rest), this );
            },
            enumerable: false,
        });
    });
}


//
// 元素创建。
// 集合是作为数据使用，分别创建并返回一个集合。
// 用法：
// $(...).Element('p') => Collector[<p>...]
/////////////////////////////////////////////////
elsEx([
        'Element',
        'svg',
    ],
    // @param {String} tag 元素标签
    // @param {...Value} rest 除数据外的剩余参数
    (fn, list, tag, ...rest) =>
        list.map( data => tQuery[fn](tag, data, ...rest) )
);


// 创建节点/文档片段。
// 用法：
// $(...).Text() => Collector[#text...]
/////////////////////////////////////////////////
elsEx([
        'Text',
        'create',
    ],
    (fn, list, ...rest) => list.map( data => tQuery[fn](data, ...rest) )
);


//
// 元素检索。
// tQuery.xx 成员调用返回单个元素或null。
// 注：
// next/prev因until参数可能导致重复。
// 结果集已清除null值并去重排序。
/////////////////////////////////////////////////
elsEx([
        'next',
        'prev',
        'parent',
        'closest',
        'offsetParent',
    ],
    (fn, els, ...rest) =>
        uniqueSort(
            els.map( el => tQuery[fn](el, ...rest) ).filter( el => el != null ),
            sortElements
        )
);


//
// 元素/节点（集）。
// 注：大部分结果集是一个二维数组。
/////////////////////////////////////////////////
elsEx([
        // 元素集
        // 扁平化时需去重/排序。
        'nextAll',
        'nextUntil',
        'prevAll',
        'prevUntil',
        'parents',
        'siblings',
        'parentsUntil',

        // 节点集
        // 扁平化时无需去重。
        'unwrap',
        'children',
        'contents',
        'empty',

        // 单成员
        // 无需扁平化和去重。
        'clone',
    ],
    (fn, els, ...rest) => els.map( el => tQuery[fn](el, ...rest) )
);


//
// 包裹特例。
// - 支持集合成员与值数组的一一对应，无对应者取前一个值对应。
// - 若需停止默认前值对应，可明确设置值成员为一个null值。
// 注：
// 这种前值保留的特性特定于本接口的优化。
///////////////////////////////////////////////////////////
elsEx([
        'wrap',
        'wrapInner',
    ],
    /**
     * 集合版的内外包裹。
     * - 克隆和事件绑定的克隆仅适用于既有元素容器。
     * @param  {String} fn 方法名称
     * @param  {Collector} els 节点/元素集
     * @param  {Element|[Element]|String|[String]} box 容器元素或html字符串
     * @param  {Boolean} clone 容器元素是否克隆
     * @param  {Boolean} event 容器元素上的事件绑定是否克隆
     * @param  {Boolean} eventdeep 容器子孙元素上的事件绑定是否克隆
     * @return {[Element]} 包裹的容器元素集
     */
    ( fn, els, box, clone, event, eventdeep ) => {
        let _buf = [];

        if ( isArr(box) ) {
            let _box = null;
            els.forEach(
                (el, i) => (_box = _validBox(box, i, _box)) && _buf.push( tQuery[fn](el, _box, clone, event, eventdeep) )
            );
        } else {
            els.forEach(
                el => _buf.push( tQuery[fn](el, box, clone, event, eventdeep) )
            );
        }
        return _buf;
    }
);


/**
 * 提取有效的成员值。
 * 如果成员为undefined，返回前一次暂存值。
 * 优化集合版wrap的未定义容器行为。
 *
 * @param {[String|Element]} box 容器元素或HTML结构串数组
 * @param {Number} i 当前下标
 * @param {String|Element} prev 前一个暂存值
 */
function _validBox( box, i, prev ) {
    return box[i] === undefined ? prev : box[i];
}



/**
 * Collector 普通方法集成。
 * 将单元素版非节点获取类操作集成到 Collector 上，设置为不可枚举。
 * @param {Array} list 定义名清单（方法）
 * @param {Function} get 获取目标函数
 */
function elsExfn( list, get ) {
    list
    .forEach(function( fn ) {
        Reflect.defineProperty(Collector.prototype, fn, {
            value: get(fn),
            enumerable: false,
        });
    });
}


//
// 简单取值。
// 返回一个值集（Collector），与集合中元素一一对应。
/////////////////////////////////////////////////
elsExfn([
        'cssGets',
        'is',
        'hasClass',
        'classAll',
        'innerHeight',
        'outerHeight',
        'innerWidth',
        'outerWidth',
        'position',
        // 主要为操作，但返回值集
        'trigger',
    ],
    fn =>
    function( ...rest ) {
        return this.map( el => tQuery[fn](el, ...rest) );
    }
);


//
// 单纯操作。
// 返回当前实例本身。
/////////////////////////////////////////////////
elsExfn([
        'normalize',
        'toggleAttr',
        'toggleClass',
        'on',
        'one',
        'off',

        // 原生事件类方法调用（可能激发事件）
        // 'blur'
        // 'click'
        // ...
    ].concat(callableNative),
    fn =>
    function( ...rest ) {
        for ( let el of this ) tQuery[fn]( el, ...rest );
        return this;
    }
);


//
// 简单操作。
// 支持名称数组分别一一对应。
// 返回当前实例自身。
/////////////////////////////////////////////////
elsExfn([
        'addClass',
        'removeClass',
        'removeAttr',
    ],
    fn =>
    function( names ) {
        let _ia = isArr(names);
        // undefined成员自然忽略，
        // removeClass中undefined含义正确。
        this.forEach(
            (el, i) => tQuery[fn](el, _ia ? names[i] : names)
        );
        return this;
    }
);


//
// 目标特性/属性取值或设置。
// 取值时name支持数组与元素集成员一一对应（名称本身可能是空格分隔的序列）。
// 设置时：
// - name支持数组单元与元素集成员一一对应。
// - value支持数组单元优先与元素集成员一一对应（值本身可为子数组）。
// - 若name和value皆为数组，并列与元素集成员一一对应。
// - 任意数组成员为空时，简单忽略对应元素的设置。
// 返回值：
// 取值：一个值集（Collector），成员与集合元素一一对应。
// 设置：实例自身（this）。
/////////////////////////////////////////////////
elsExfn([
        'attr',
        'attribute',
        'prop',
        'property',
        'css',
    ],
    fn =>
    function( name, value ) {
        let _nia = isArr(name);

        if ( value === undefined &&
            (typeof name == 'string' || _nia && typeof name[0] == 'string') ) {
            return _customGets( fn, this, name, _nia );
        }
        return _customSets( fn, this, name, value, _nia ), this;
    }
);


/**
 * 获取元素特性/属性/样式值（集）。
 * 集合版专用：支持名称（序列）数组的一一对应。
 * 注：
 * 名称数组成员本身可能是空格分隔的名称序列。
 *
 * @param  {String} fn 方法名
 * @param  {Collector} self 当前集
 * @param  {String|[String]} name 名称序列（集）
 * @param  {Boolean} nia 名称为数组
 * @return {Collector} 结果值集
 */
function _customGets( fn, self, name, nia ) {
    if ( !nia ) {
        return self.map( el => tQuery[fn](el, name) );
    }
    let _buf = [];

    self.forEach( (el, i) =>
        name[i] !== undefined && _buf.push( tQuery[fn](el, name[i]) )
    )
    return new Collector( _buf, self );
}


/**
 * 设置元素特性/属性/样式值（集）。
 * 集合版专用：支持name为配置对象数组与成员一一对应。
 * 集合成员无值数组成员对应时简单忽略。
 * @param {String} fn 方法名
 * @param {[Element]} els 元素集
 * @param {String|[String|Object|Map]} name 名称序列（集）
 * @param {Value|[Value]} val 设置的值（集）
 * @param {Boolean} nia 名称为数组
 */
function _customSets( fn, els, name, val, nia ) {
    if ( nia ) {
        return _namesVals( fn, els, name, val );
    }
    if ( isArr(val) ) {
        return els.forEach( (el, i) => val[i] !== undefined && tQuery[fn](el, name, val[i]) );
    }
    // 全部相同赋值。
    return els.forEach( el => tQuery[fn](el, name, val) );
}


/**
 * 多名称:多值对应设置。
 * 如果名称单元或值单元未定义，对应元素成员设置忽略。
 * @param {String} fn 方法名
 * @param {[Element]} els 元素集
 * @param {[String|Object|Map]} name 名称/序列（集）
 * @param {Value|[Value]} val 设置的值（集）
 */
function _namesVals( fn, els, name, val ) {
    if ( isArr(val) ) {
        return els.forEach( (el, i) =>
            name[i] !== undefined && val[i] !== undefined && tQuery[fn](el, name[i], val[i])
        );
    }
    // 全部相同赋值。
    return els.forEach( (el, i) => name[i] !== undefined && tQuery[fn](el, name[i], val) );
}


//
// 特定属性取值/修改。
// 设置与获取两种操作合二为一的成员。
// 设置时支持值数组与集合成员一一对应赋值。
// 返回值：
// 取值：一个值集（Collector），成员与集合元素一一对应。
// 设置：实例自身（this）。
/////////////////////////////////////////////////
elsExfn([
        'val',
        'height',
        'width',
        'offset',
        'scroll',
        'scrollLeft',
        'scrollTop',
    ],
    fn =>
    function( value ) {
        if (value === undefined) {
            return this.map( el => tQuery[fn](el) );
        }
        if (isArr(value)) {
            this.forEach( (el, i) => value[i] !== undefined && tQuery[fn](el, value[i]) );
        }
        else {
            this.forEach( el => tQuery[fn](el, value) );
        }
        return this;
    }
);


//
// 内容取值/设置。
// 取值时返回一个值集，成员与集合元素一一对应。
// 设置时返回新插入的节点集。
// 支持内容值数组与集合成员一一对应赋值。
// 注：
// html设置时的返回值为一个节点集的Collector实例，
// 可通过 Collector.flat() 扁平化。
//
// @return {Collector}
/////////////////////////////////////////////////
elsExfn([
        'html',
        'text',
    ],
    fn =>
    function( val, ...rest ) {
        if (val === undefined) {
            return this.map( el => tQuery[fn](el) );
        }
        let _vs = isArr(val) ?
            _arrSets(fn, this, val, ...rest) : this.map(el => tQuery[fn](el, val, ...rest));

        return new Collector( _vs, this );
    }
);


/**
 * 上面集合版设置调用辅助。
 * 在设置值为一个数组时，一一对应但忽略未定义项。
 * @param  {String} fn 调用名
 * @param  {Collector} els 目标集合
 * @param  {[Value]} val 值数组
 * @param  {[Value]} rest 剩余参数
 * @return {[Node]} 节点（集）数组
 */
function _arrSets( fn, els, val, ...rest ) {
    let _buf = [];

    els.forEach( (el, i) =>
        val[i] !== undefined && _buf.push( tQuery[fn](el, val[i], ...rest) )
    );
    return _buf;
}


//
// 节点插入（多对多）。
// 因为节点数据会移动，所以通常应该是克隆模式。
// 支持值数组与集合成员一一对应。
// 返回值可能是一个节点数组的集合（二维），与源数据形式有关。
/////////////////////////////////////////////////
elsExfn([
        'before',
        'after',
        'prepend',
        'append',
        'replace',
        'fill',
    ],
    /**
     * 集合版节点内容插入。
     * @param  {Node|[Node]|Collector|Set|Iterator|Function} cons 数据节点（集）或回调
     * @param  {Boolean} clone 数据节点克隆
     * @param  {Boolean} event 是否克隆事件处理器（容器）
     * @param  {Boolean} eventdeep 是否深层克隆事件处理器（子孙元素）
     * @return {Collector} 新插入的节点集
     */
    fn => function( cons, clone, event, eventdeep ) {
        let _buf;

        if ( isArr(cons) ) {
            _buf = _arrInsert(fn, this, cons, clone, event, eventdeep);
        } else {
            _buf = _conInsert(fn, this, cons, clone, event, eventdeep);
        }
        return new Collector( _buf, this );
    }
);


//
// 内容为数组一一对应插入。
// @param  {[Node]|Collector|[Value]} cons 数据节点或回调集
// @param  {Boolean} clone 是否节点克隆
// @param  {Boolean} event 是否克隆事件处理器（容器）
// @param  {Boolean} eventdeep 是否深层克隆事件处理器（子孙元素）
// @return {[Node]} 新插入的节点集
//
function _arrInsert( fn, els, cons, clone, event, eventdeep ) {
    let _buf = [];

    for ( let [i, el] of els.entries() ) {
        let _con = cons[i];

        if ( _con != null ) {
            _buf.push( tQuery[fn](el, _con, clone, event, eventdeep) );
        }
    }
    return _buf;
}


//
// 内容简单插入（非数组）。
// 注：con可能为函数或迭代器，因此也可能返回数组。
// @param  {Node|Set|Iterator|Function} cons 数据节点回调
// @param  {Boolean} clone 是否节点克隆
// @param  {Boolean} event 是否克隆事件处理器（容器）
// @param  {Boolean} eventdeep 是否深层克隆事件处理器（子孙元素）
// @return {[Node]} 新插入的节点集
//
function _conInsert( fn, els, con, clone, event, eventdeep ) {
    let _buf = [];

    for ( let el of els ) {
        _buf.push( tQuery[fn](el, con, clone, event, eventdeep) );
    }
    return _buf;
}



//
// 集合版6种插入方式（多对一）。
// 与单元素版对应但主从关系互换。
/////////////////////////////////////////////////
[
    ['insertBefore',    'before'],
    ['insertAfter',     'after'],
    ['prependTo',       'prepend'],
    ['appendTo',        'append'],
    ['replaceAll',      'replace'],
    ['fillTo',          'fill'],
]
.forEach(function( names ) {
    Reflect.defineProperty(Collector.prototype, [names[0]], {
        /**
         * 将集合中的元素插入相应位置。
         * - 默认不会采用克隆方式（原节点会脱离DOM）。
         * - 传递clone为真，会克隆集合内的节点后插入（强制深层克隆）。
         * - 如果需同时包含事件克隆，传递event/eventdeep为true。
         * 注：
         * 如果克隆，会创建新节点集的Collector实例进入链式栈，
         * 用户可通过.end()获得该集合。
         * @param  {Node|Element} to 参考节点或元素
         * @param  {Boolean} clone 数据节点克隆
         * @param  {Boolean} event 是否克隆事件处理器（容器）
         * @param  {Boolean} eventdeep 是否深层克隆事件处理器（子孙元素）
         * @return {Collector} 目标参考节点的Collector实例
         */
        value: function( to, clone, event, eventdeep ) {
            let _ret = tQuery[ names[1] ](
                    to, this, clone, event, eventdeep
                );
            return new Collector(
                    to,
                    // 克隆时会嵌入一个新节点集
                    clone ? new Collector(_ret, this) : this
                );
        },
        enumerable: false,
    });
});



//
// 基本工具。
///////////////////////////////////////////////////////////////////////////////

//
// 字符序列切分器。
// 按指定的分隔符切分字符序列，但忽略字符串内的分隔符。
//
class Spliter {
    /**
     * 切分器构造。
     * 一个分隔符对应一个实例。
     * @param {String} sep 分隔符
     */
    constructor( sep ) {
        this._sep = sep;
        this._qch = '';
        this._esc = false;
    }


    /**
     * 序列切分。
     * 可以限制切分的最大次数，如：1次两片，2次3片。
     * @param  {String} fmt 字符序列
     * @param  {Number} cnt 切分的最大计数，可选
     * @return {Iterator} 切分迭代器
     */
    *split( fmt, cnt = -1 ) {
        let _ss = '',
            _ew = fmt.endsWith(this._sep);

        while ( fmt && cnt-- ) {
            [_ss, fmt] = this._pair(fmt, this._sep);
            yield _ss;
        }
        // 末端分隔符切出空串。
        if ( fmt || _ew ) yield fmt;
    }


    reset() {
        this._qch = '';
        this._esc = false;
    }


    //-- 私有辅助 -------------------------------------------------------------


    /**
     * 简单的2片切分。
     * - 检查起点在字符串之外，因此无需检查转义（\x）。
     * - 可以正确处理4字节Unicude码点。
     * @param  {String} fmt 格式串
     * @param  {String} sep 分隔符
     * @return {[String, String]} 前段和后段
     */
    _pair( fmt, sep ) {
        let _len = 0;

        for ( let ch of fmt ) {
            if ( !this._inside(ch) && ch == sep ) {
                break;
            }
            _len += ch.length;
        }
        return [ fmt.substring(0, _len), fmt.substring(_len+sep.length) ];
    }


    /**
     * 是否在字符串内。
     * 引号包含：双引号/单引号/模板字符串撇号。
     * @param  {string} ch 当前字符
     * @return {Boolean}
     */
    _inside( ch ) {
        if (ch == '"' || ch == "'" || ch == '`') {
            return this._quote(ch);
        }
        return this._escape(ch), !!this._qch;
    }


    /**
     * 设置引号。
     * @param  {String} ch 当前字符
     * @return {Boolean}
     */
    _quote( ch ) {
        if ( !this._esc ) {
            // 开始
            if (this._qch == '') this._qch = ch;
            // 结束
            else if (this._qch == ch) this._qch = '';
        }
        return true;
    }


    /**
     * 处理转义字符。
     * @param  {String} ch 当前字符
     * @return {Boolean}
     */
    _escape( ch ) {
        if ( !this._qch || ch != '\\' ) {
            return this._esc = false;
        }
        if ( ch == '\\' ) this._esc = !this._esc;
    }
}

//
// 并列选择器切分器。
//
const spliter = new Spliter(',');


/**
 * 是否为纯数字。
 * from jQuery 3.x
 * @param  {Mixed}  obj 测试目标
 * @return {Boolean}
 */
function isNumeric( obj ) {
    let _t = typeof obj;
    return ( _t === "number" || _t === "string" ) &&
        !isNaN( obj - parseFloat( obj ) );
}


//
// 是否为窗口。
//
function isWindow( obj ) {
    return obj !== null && obj === obj.window;
}


/**
 * 获取数组成员，支持负数。
 * @param {Array} list 数据数组
 * @param {Number} idx 位置下标
 */
function indexItem( list, idx ) {
    return list[ idx < 0 ? list.length + idx : idx ];
}


// 网格项定位属性。
const gridPosition = [
    'grid-column-start',
    'grid-column-end',
    'grid-row-start',
    'grid-row-end',
];


/**
 * 检查并返回定位容器元素。
 * 不是定位容器时返回false。
 * @param  {Element} box 容器元素
 * @param  {CSSStyleDeclaration} cso 计算样式对象
 * @return {Element|false}
 */
function offsetBox( box, cso, sub, subcso ) {
    if ( cso.display === 'grid' ) {
        if ( cso.position === 'static' ) {
            return false;
        }
        return gridPosition.some( n => subcso[n] !== 'auto' ) ? sub : box;
    }
    return (cso.position !== 'static' || cso.display === 'flex' || box.nodeName === 'svg') && box;
}


//
// 是否为函数。
// from jQuery v3.4
//
function isFunc( obj ) {
    // Support: Chrome <=57, Firefox <=52
    // In some browsers, typeof returns "function" for HTML <object> elements
    // (i.e., `typeof document.createElement( "object" ) === "function"`).
    // We don't want to classify *any* DOM node as a function.
    return typeof obj === "function" && typeof obj.nodeType !== "number";
}


/**
 * 数组扁平化（1层深）。
 * @param  {Array} arr 数组数据
 * @return {Array}
 */
 function arrFlat( arr ) {
    return arr.reduce( (buf, v) => buf.concat(v), [] );
}


//
// 创建过滤器函数。
// 返回值：function(Element): Boolean
// @param  {String|Function|Array|Value} its 过滤表达
// @return {Function|its}
//
function getFltr( its ) {
    if ( !its ) {
        return () => true;
    }
    if ( isFunc(its) ) {
        return its;
    }
    if ( typeof its == 'string' ) {
        return e => e && $is(e, its);
    }
    return isArr(its) ? e => its.includes(e) : e => e === its;
}


//
// 创建包含测试函数。
// 注：仅支持字符串选择器和元素测试。
// @param  {String|Element}
// @return {Function}
//
function hasFltr( its ) {
    if (typeof its == 'string') {
        return e => !!tQuery.get(its, e);
    }
    if (its && its.nodeType) {
        return e => its !== e && $contains(e, its);
    }
    return () => false;
}


/**
 * 是否为 Collector 实例。
 * @param  {Mixed} obj 测试对象
 * @return {Boolean}
 */
function isCollector( obj ) {
    return obj && !!obj[ ownerToken ];
}


/**
 * 构造Collector成员实参。
 * - 用于基类构造后添加初始成员。
 * @param  {Element|Iterator|Array|Window|Document} obj 目标对象
 * @return {Iterator|[Value]} 可迭器或数组
 */
function arrayArgs( obj ) {
    if ( obj == null ) {
        return [];
    }
    if ( isWindow(obj) || obj.nodeType) {
        return [obj];
    }
    return obj[Symbol.iterator] ? obj : [obj];
}


/**
 * 像素值转换数值。
 * - 像素单位转为纯数值。
 * - 非像素或数值返回null。
 * @param  {String|Number} val
 * @return {Number|null}
 */
function pixelNumber( val ) {
    return isNumeric(val) || rpixel.test(val) ? parseFloat(val) : null;
}


/**
 * 构造范围数字序列。
 * @param  {Number} beg 起始值
 * @param  {Number} len 长度
 * @param  {Number} step 步进增量
 * @return {Iterator} 范围生成器
 */
function* rangeNumber( beg, len, step = 1 ) {
    if (len <= 0) {
        return null;
    }
    beg -= step;
    while (len--) yield beg += step;
}


/**
 * 构造Unicode范围字符序列。
 * - len为终点字符时，其本身包含在范围内（末尾）。
 * @param  {Number} beg 起始字符码值
 * @param  {Number|String} len 长度或终点字符
 * @param  {Number} step 步进增量
 * @return {Iterator} 范围生成器
 */
function* rangeChar( beg, len, step ) {
    if (len <= 0) {
        return null;
    }
    if (typeof len == 'string') {
        [len, step] = charLenStep(len, beg);
    }
    beg -= step;
    while (len--) yield String.fromCodePoint(beg += step);
}


/**
 * 计算字符的范围和步进值。
 * 起点比终点值低为逆序，步进值-1。
 * @param  {String} ch 终点字符
 * @param  {Number} beg 起始码点值
 * @return {[len, step]}
 */
function charLenStep( ch, beg ) {
    let _d = ch.codePointAt(0) - beg;
    return _d < 0 ? [-_d + 1, -1] : [_d + 1, 1];
}


/**
 * 获取键值迭代器。
 * 注：也适用普通对象。
 * @param  {.entries|Object} obj 迭代对象
 * @return {Iterator|[Array2]} 迭代器
 */
function entries( obj ) {
    return isFunc(obj.entries) ? obj.entries() : Object.entries(obj);
}


/**
 * 获取值迭代器。
 * 注：也适用普通对象。
 * @param  {Array|.values|Object} obj 迭代目标
 * @return {Iterator} 迭代器
 */
function values( obj ) {
    return isFunc(obj.values) ? obj.values() : Object.values(obj);
}


/**
 * 元素源码填充。
 * 仅用于新创建的元素，无需清空也无需触发verynode。
 * @param  {Element} el 目标元素
 * @param  {String} html 源码
 * @return {Element} el
 */
function fillElem( el, html, doc ) {
    if ( html ) {
        el.append( buildFragment(html, doc) );
    }
    return el;
}


/**
 * 从配置设置元素。
 * 支持 text|html 特殊名称设置元素内容。
 * 仅用于新创建的元素，无需触发attrvary。
 * @param  {Element} el 目标元素
 * @param  {Object} conf 配置对象
 * @return {Element} el
 */
function setElem( el, conf ) {
    if ( !conf ) {
        return el;
    }
    for ( let [k, v] of Object.entries(conf) ) {
        switch ( k ) {
        case 'html':
            fillElem( el, v ); break;
        case 'text':
            el.textContent = v; break;
        default:
            el.setAttribute( attrName(k), v );
        }
    }
    return el;
}


/**
 * 插入列表头<th>。
 * 如果没有指定位置，插入一个普通单元格（<td>）。
 * @param  {Number} where 插入位置（1|-1）
 * @param  {[Element]} buf 元素集存储
 * @param  {Document} doc 所属文档对象
 * @return {[Element]} buf
 */
function insertVth( where, buf, doc ) {
    switch ( where ) {
        case -1:
            buf.push( doc.createElement('th') ); break;
        case 1:
            buf.unshift( doc.createElement('th') ); break;
        default:
            buf.push( doc.createElement('td') );
    }
    return buf;
}


/**
 * 判断列表头位置。
 * - 首列：1
 * - 尾列：-1
 * - 无：null
 * @param  {Element} tr 表格行
 * @return {Number|null}
 */
function whereVth( tr ) {
    if ( tr ) {
        let _tds = tr.cells;

        if ( _tds[0].nodeName == 'TH' ) {
            return 1;
        }
        if ( _tds[_tds.lenght-1].nodeName == 'TH' ) {
            return -1;
        }
    }
    return null;
}


/**
 * 获取表格行适当容器。
 * 用于<tr>直接插入到<table>时获取正确的容器。
 * - 若容器不是表格则简单返回容器。
 * - 若容器合法但内容不是<tr>元素，返回null。
 * - 兼容内容是包含<tr>的文档片段。
 * 注：
 * 不检查表格行插入到非表格元素时的情况。
 *
 * @param  {Element} box 容器元素
 * @param  {Node|[Node]} sub 内容节点（集）
 * @return {Element|null} 合适的容器元素
 */
function trContainer( box, sub ) {
    if ( !box.tBodies ) return box;

    if ( isArr(sub) ) {
        sub = sub[0];
    }
    return sub.cells ? box.tBodies[0] : null;
}


/**
 * 获取计算样式。
 * @param  {Element} el
 * @return {CSSStyleDeclaration}
 */
function getStyles( el ) {
    // Support: IE <=11 only, Firefox <=30 (#15098, #14150)
    // IE throws on elements created in popups
    // FF meanwhile throws on frame elements through "defaultView.getComputedStyle"
    var view = el.ownerDocument.defaultView;

    if ( !view || !view.opener ) {
        view = window;
    }

    return view.getComputedStyle(el);
}


/**
 * 节点按DOM中顺序排序。
 * - 外部保证节点已经去除重复；
 * @param  {Node} a
 * @param  {Node} b
 * @return {Number} [-1, 0, 1]
 */
function sortElements( a, b ) {
    let _comp = a.compareDocumentPosition( b );

    if (_comp & 1) {
        throw new Error('Can not compare nodes between two different documents');
    }
    // 子元素时浏览器返回20，包含16和4
    return _comp & 4 ? -1 : 1;
}


//
// 名称转换。
// 可用于CSS属性名和data系prop名称。
//
function camelCase( name ) {
    return name
        // Support: IE <=9 - 11, Edge 12 - 13
        // Microsoft forgot to hump their vendor prefix (#9572)
        .replace( /^-ms-/, "ms-" )
        // 短横线分隔转为驼峰表示。
        .replace( /-[a-z]/g, cc => cc[1].toUpperCase() );
}


/**
 * 设置样式值。
 * name为字符串时仅支持单个名称。
 * @param  {Element} el 目标元素
 * @param  {String|Object|Map} name 样式名或名值对对象
 * @param  {String|Number|Function} val 设置值或取值回调
 * @param  {CSSStyleDeclaration} cso 计算样式集
 * @return {void}
 */
function cssSets( el, name, val, cso ) {
    if (typeof name == 'string') {
        return cssArrSet(
            el,
            name.trim().split(__reSpace),
            val,
            cso
        );
    }
    for (let [n, v] of entries(name)) cssSet(el, n, v, cso);
}


/**
 * 多名称样式设置。
 * 样式值可能为一个数组，需一一对应设置（无对应者忽略）。
 * @param {Element} el 目标元素
 * @param {[String]} names 名称集
 * @param {Value|[Value]} val 值或值集
 * @param {CSSStyleDeclaration} cso 计算样式集
 */
function cssArrSet( el, names, val, cso ) {
    if ( !isArr(val) ) {
        return names.forEach( n => cssSet(el, n, val, cso) );
    }
    names.forEach(
        (n, i) => val[i] !== undefined && cssSet(el, n, val[i], cso)
    );
}


/**
 * 设置单个元素的单个样式值。
 * 样式值可能为纯数字（视为像素）或取值回调。
 * @param {Element} el 目标元素
 * @param {String} name 样式名
 * @param {Value|Function} val 样式值
 * @param {CSSStyleDeclaration} cso 计算样式集
 */
function cssSet( el, name, val, cso ) {
    let _v = isFunc(val) ?
        val( cso[name], el ) :
        val;

    setStyle( el, name, isNumeric(_v) ? `${+_v}px` : _v );
}


/**
 * 选择性插入。
 * 首选插入next之前，否则box内末尾添加。
 * @param  {Node} node 待插入节点
 * @param  {Element} next 下一个参考元素
 * @param  {Element} box 容器元素，可选
 * @return {Node} 插入节点
 */
function switchInsert( node, next, box ) {
    if (next) {
        return next.parentNode.insertBefore(node, next);
    }
    return box.appendChild(node);
}


/**
 * 载入元素。
 * - 绑定载入成功与错误的处理，返回一个承诺对象。
 * - 主要用于脚本/样式元素的载入回调。
 * 承诺.then(el | undefined)
 * @param  {Element} el  目标元素
 * @param  {Node} next 下一个参考节点
 * @param  {Element} box 容器元素，可选
 * @param  {Boolean} tmp 为临时插入（成功后移除）
 * @return {Promise}
 */
function loadElement( el, next, box, tmp ) {
    if (el.nodeType != 1) {
        throw new Error('el not a element');
    }
    return new Promise( function(resolve, reject) {
        tQuery.one(el, {
            'load':  () => resolve( tmp ? varyRemove(el, el.parentElement) : el ),
            'error': err => reject(err),
        });
        switchInsert(el, next, box);
    });
}


/**
 * 提取最深层子元素。
 * @param  {Element} el 目标元素
 * @return {Element}
 */
function deepChild( el ) {
    let _sub = el.firstElementChild;
    if (!_sub) return el;

    return deepChild(_sub);
}


/**
 * 获取包裹容器。
 * HTML结构容器会递进到首个最深层子元素。
 * @param  {HTML|Element} box 包裹容器
 * @param  {Boolean} clone 包裹元素是否克隆
 * @param  {Boolean} event 包裹元素上注册的事件处理器是否克隆
 * @param  {Boolean} eventdeep 包裹元素子孙元素上注册的事件处理器是否克隆
 * @param  {Document} doc 所属文档对象
 * @return {Element, Element} 包裹容器和原根元素
 */
function wrapBox( box, clone, event, eventdeep, doc ) {
    if ( box.nodeType ) {
        return [ clone ? tQuery.clone(box, event, true, eventdeep) : box ];
    }
    // string
    box = buildFragment(box, doc).firstElementChild;

    return [ deepChild(box), box ];
}


/**
 * 类名切换。
 * 支持空格分隔的多个类名。
 * @param  {Element} el 目标元素
 * @param  {[String]} names 类名称集
 * @param  {Boolean} force 强制设定，可选
 * @return {void}
 */
function classToggle( el, names, force ) {
    if ( force === true ) {
        return addClass( el, names );
    }
    if ( force === false ) {
        return removeClass( el, names );
    }
    toggleClass( el, names );
}


/**
 * 元素类属性切换。
 * @param  {Element} el 目标元素
 * @param  {Boolean} force 是否强制指定
 * @return {void}
 */
function classAttrToggle( el, force ) {
    let _cls = el.getAttribute('class');

    if ( _cls ) {
        __classNames.set( el, _cls.trim() );
    }
    toggleClassAttr( el, force ? __classNames.get(el) || null : null, _cls );
}


/**
 * 是否为可提交类控件元素。
 * 即便input:checkbox|radio为未选中状态，它们也是可提交类控件。
 * 注：.val 取值为空的控件会被排除，因此不会影响提交逻辑。
 * @param  {Element} ctrl 控件元素
 * @return {Boolean}
 */
function submittable( ctrl ) {
    return ctrl.name &&
        !$is(ctrl, ':disabled') &&
        rsubmittable.test( ctrl.nodeName ) && !rsubmitterTypes.test( ctrl.type );
}


/**
 * 按名称合并元素。
 * 注：相同名称的元素会重复获取值，故排除。
 * @param {[Element]} els 元素集
 */
function uniqueNamed( els ) {
    let _map = els.reduce(
            (buf, el) => buf.set(el.name, el),
            new Map()
        );
    return [..._map.values()];
}


/**
 * 提取可提交控件元素的名值对（集）。
 * 名值对：[name, value]
 * @param  {Element} ctrl 可提交控件元素
 * @return {Array2|[Array2]}
 */
function submitValues( ctrl ) {
    let _v = tQuery.val(ctrl);

    if (isArr(_v)) {
        return _v.length ? _v.map( v => submitValue(ctrl, v) ) : null;
    }
    // null|undefined
    return _v == null ? null : submitValue(ctrl, _v);
}


/**
 * 构造控件名值对。
 * @param {Element} ctrl 可提交控件
 * @param {String} value 控件值
 */
function submitValue( ctrl, value ) {
    return [
        ctrl.name,
        value.replace( rCRLF, "\r\n" )
    ];
}


/**
 * 双成员数组展开（合并）。
 * 注：成员是二维数组才会扁平化展开。
 * @param  {[Array2|[Array2]]} src 源数组
 * @return {[Array2]}
 */
function arr2Flat( src ) {
    return src.reduce(
        (buf, its) => isArr(its[0]) ? buf.concat(its) : (buf.push(its), buf),
        []
    );
}


/**
 * 属性/特性取值判断。
 * @param {[String]|Object} name 属性/特性名序列
 * @param {Value|undefined} val 设置值
 */
function hookIsGet( name, val ) {
    return val === undefined && isArr( name );
}


/**
 * 通用赋值。
 * - 调用目标域内的set设置值，接口：set(el, key, value)
 * - 值可为回调取值，接口：value( get(el, key), el )
 * 参数：
 * - name支持字符串或一个名/值对象（Object|Map）。
 * - value为一个值集或新值或获取新值的回调函数。
 * - 名/值对象中的值依然可以是回调函数（与键对应）。
 *
 * @param  {Element} el 目标元素
 * @param  {[String]|Object|Map} name 名称序列或名/值对象
 * @param  {[Value]|Value|Function} value 设置值（集）或取值回调
 * @param  {Object} scope 适用域对象
 * @return {void}
 */
function hookSets( el, name, value, scope ) {
    if ( isArr(name) ) {
        hookArrSet( el, name, value, scope );
        return;
    }
    for (let [k, v] of entries(name)) hookSet(el, attrName(k), v, scope);
}


/**
 * 多名称值集设置。
 * 属性/特性值可能为数组，需一一对应（未对应忽略）。
 * @param {Element} el 目标元素
 * @param {[String]} names 名称集
 * @param {Value|[Value]} val 值或值集
 * @param {Object} scope 适用域对象
 */
function hookArrSet( el, names, val, scope ) {
    if ( names.length == 1 ) {
        return hookSet(el, names[0], val, scope);
    }
    if ( isArr(val) ) {
        return names.forEach( (n, i) => val[i] !== undefined && hookSet(el, n, val[i], scope) );
    }
    names.forEach( n => hookSet(el, n, val, scope) );
}


/**
 * 属性/特性设置。
 * @param {Element} el 目标元素
 * @param {String} name 名称
 * @param {Value|Function} val 设置值
 * @param {Object} scope 适用域对象
 */
function hookSet( el, name, val, scope ) {
    if ( isFunc(val) ) {
        val = val( el, name );
    }
    customSet( el, name, val, scope );
}


/**
 * 定制版设置。
 * 支持2个特别的属性：text 和 html（fill方式）。
 * @param {Element} el 设置的目标元素
 * @param {String} name 属性名
 * @param {Value} value 属性值
 * @param {Object} scope 适用域对象
 */
function customSet( el, name, value, scope ) {
    switch (name) {
        case 'text':
            return Insert(el, el.ownerDocument.createTextNode(value), '');
        case 'html':
            return Insert(el, buildFragment(value, el.ownerDocument), '');
    }
    scope.set( el, name, value );
}


/**
 * 通用多取值。
 * 多个名称时返回一个名/值对象，否则返回单个值。
 * @param  {Element} el 目标元素
 * @param  {[String]} name 名称集
 * @param  {Object} scope 适用域对象
 * @return {String|Object} 值或名/值对象
 */
function hookGets( el, name, scope ) {
    if ( name.length == 1 ) {
        return customGet(el, name[0], scope);
    }
    let _obj = {};
    name.forEach( n => _obj[n] = customGet(el, n, scope) );

    return _obj;
}


/**
 * 定制版取值。
 * 支持2个特别属性：text 和 html。
 * @param {Element} el 取值目标元素
 * @param {String} name 属性名
 * @param {Object} scope 适用域对象
 */
function customGet( el, name, scope ) {
    switch (name) {
        case 'text':
            return el.textContent;
        case 'html':
            return el.innerHTML;
    }
    return scope.get(el, name);
}


/**
 * 获取切换值。
 * 如果val为数组，则在[0-1]单元间切换（以[0]为对比目标）。
 * 如果val为普通的值，则在有无间切换（val|''）。
 * @param {Value|[Value]} val 值（集）
 * @param {Value} old 原来的值
 */
function toggleValue( val, old ) {
    if ( val == null ) {
        return old == null ? '' : null;
    }
    if ( isArr(val) ) {
        return old == val[0] ? val[1] : val[0];
    }
    return val == old ? '' : val;
}


/**
 * 偏移坐标转为位置坐标。
 * - 偏移坐标不含外边距，位置坐标从外边距左上角算起；
 * - 两者坐标都用 {top, left} 表示；
 * @param  {Object} offset 元素偏移坐标
 * @param  {CSSStyleDeclaration} css 元素计算样式对象
 * @return {Object} 位置坐标对象
 */
function toPosition( offset, css ) {
    return {
        top:  offset.top - parseFloat(css.marginTop),
        left: offset.left - parseFloat(css.marginLeft)
    };
}


/**
 * 获取元素的偏移坐标。
 * 相对于文档根元素。
 * 返回值格式：{
 *      top:  number,
 *      left: number
 * }
 * @param  {Element} el 目标元素
 * @return {Object}
 */
function getOffset( el ) {
    // Return zeros for disconnected and hidden (display: none) elements (gh-2310)
    // Support: IE <=11 only
    // Running getBoundingClientRect on a disconnected node in IE throws an error
    if (!el.getClientRects().length) {
        return { top: 0, left: 0 };
    }
    let _doc  = el.ownerDocument,
        _win  = _doc.defaultView,
        _root = _doc.documentElement,
        _rect = el.getBoundingClientRect();

    return {
        top:  _rect.top + _win.pageYOffset - _root.clientTop,
        left: _rect.left + _win.pageXOffset - _root.clientLeft
    };
}


/**
 * 计算最终使用偏移坐标。
 * 用户指定的非法坐标值忽略。
 * @param  {Object} cur  当前实际偏移
 * @param  {Object} conf 用户坐标配置
 * @param  {Object} self 元素样式坐标
 * @return {Object} 坐标对象：{top, left}
 */
function useOffset( cur, conf, self ) {
    let _use = {};

    if (typeof conf.top == 'number') {
        _use.top = (conf.top - cur.top) + self.top;
    }
    if (typeof conf.left == 'number') {
        _use.left = (conf.left - cur.left) + self.left;
    }
    return _use;
}


/**
 * 清除目标元素的偏移样式。
 * 注：这不是撤消之前的设置，而是清除（包括定位样式）。
 * @param {Element} el 目标元素
 */
function clearOffset( el ) {
    let _cso = el.style;

    _cso.top = null;
    _cso.left = null;
    _cso.position = null;

    if (_cso.cssText.trim() == '') {
        // 清理：不激发attr系事件
        el.removeAttribute('style');
    }
}


/**
 * 计算元素当前偏移样式值。
 * - 指样式设定的计算结果；
 * - 返回 {top, left}
 * @param  {Element} el 目标元素
 * @return {Object}
 */
function calcOffset( el ) {
    let _cso = getStyles(el);

    // 包含定位属性，获取明确值。
    if ((_cso.position == 'absolute' || _cso.position == 'fixed') &&
        [_cso.top, _cso.left].includes('auto')) {
        let _pos = tQuery.position(el);
        return {
            top:  _pos.top,
            left: _pos.left
        };
    }
    return {
        top:  parseFloat(_cso.top) || 0,
        left: parseFloat(_cso.left) || 0
    };
}


/**
 * 测试获取窗口对象。
 * @param  {Element|Window|Document} el
 * @return {Window|null}
 */
function getWindow( el ) {
    if (isWindow(el))
        return el;

    return el.nodeType == 9 ? el.defaultView : null;
}


/**
 * 设置窗口/元素滚动条。
 * @param {Element|Window} dom 目标对象
 * @param {Number} val 设置值
 * @param {String} xy  位置标志
 */
function scrollSet( dom, val, xy ) {
    switch (xy) {
    case 'T':
        return (dom.scrollTop = val);
    case 'Y':
        return dom.scrollTo(dom.pageXOffset, val);
    case 'L':
        return (dom.scrollLeft = val);
    case 'X':
        return dom.scrollTo(val, dom.pageYOffset);
    }
}


/**
 * 检查并返回普通节点。
 * - 普通节点包含元素/文本/注释节点；
 * @param  {Node} node 目标节点
 * @return {Boolean}
 */
function usualNode( node ) {
    let _nt = node.nodeType;
    return _nt == 1 || (_nt == 3 && node.textContent.trim()) || _nt == 8;
}


/**
 * 过滤出有效的节点集。
 * - 仅包含元素和非空文本节点。
 * @param  {Node} node 节点
 * @return {Nude|null}
 */
function masterNode( node ) {
    let _nt = node.nodeType;
    return _nt == 1 || _nt == 3 && node.textContent.trim();
}


/**
 * 提取节点源码/文本。
 * - 适用于元素节点和文本节点；
 * - 多个节点取值简单连接；
 * - 非节点类型被字符串化；
 * @param  {Node|[Node]|[String]|Set} nodes 节点（集）
 * @param  {String} sep 连接字符
 * @return {String}
 */
function outerHtml( nodes, sep ) {
    let _buf = [];
    nodes = nodes.nodeType ? [nodes] : values(nodes);

    for ( let nd of nodes ) {
        if ( nd ) {
            switch (nd.nodeType) {
            case 1:
                nd = nd.outerHTML;
                break;
            case 3:
                nd =  nd.textContent;
                break;
            }
        }
        _buf.push( '' + nd );
    }
    return _buf.join( sep );
}


/**
 * 提取节点文本。
 * @param  {Node|[Node]|[String]|Set} nodes 节点（集）
 * @param  {String} sep 连接字符
 * @return {String}
 */
function nodeText( nodes, sep ) {
    if (nodes.nodeType) {
        return nodes.textContent;
    }
    let _buf = [];

    for ( let nd of values(nodes) ) {
        _buf.push(
            nd && nd.nodeType ? nd.textContent : nd
        );
    }
    return _buf.join( sep );
}


/**
 * 将文本转义为HTML源码表示。
 * 如：< to &lt;
 * @param  {String} code 表现文本
 * @return {String} 转义后源码
 */
function htmlCode( code ) {
    let _box = Doc.createElement('div');
    _box.textContent = code;
    return _box.innerHTML;
}


/**
 * 将HTML实体表示解码为文本。
 * 如： &lt; to <
 * @param  {String} code HTML源码
 * @return {String}
 */
function htmlText( code ) {
    let _tpl = Doc.createElement('template');
    try {
        _tpl.innerHTML = code;
    }
    catch (e) {
        return window.console.error(e);
    }
    return _tpl.content.textContent;
}


/**
 * 克隆节点（集）。
 * 节点集成员支持假值忽略。
 * @param  {Node|[Node]} cons 节点（集）
 * @param  {Boolean} event 事件克隆
 * @param  {Boolean} eventdeep 事件深层克隆
 * @return {Node|[Node]}
 */
function nodesClone( cons, event, eventdeep ) {
    if ( cons.nodeType ) {
        return tQuery.clone(cons, event, true, eventdeep);
    }
    return cleanMap(
        cons,
        nd => nd && tQuery.clone(nd, event, true, eventdeep) || null
    );
}


/**
 * 提取节点/节点集。
 * 注：处理多种集合类型。
 * @param  {Node|DocumentFragment|[Node]|Set|Iterator}} cons 节点或节点集
 * @return {Node|[Node]} 节点或节点数组
 */
function nodesItem( cons ) {
    if ( cons.nodeType == 11 ) {
        return Arr( cons.childNodes );
    }
    return cons.nodeType ? cons : $A( cons );
}


/**
 * 通用节点（集）插入。
 * - 返回实际插入的节点（集）。
 * @param  {Node} node 目标节点
 * @param  {Node|[Node]} data 节点（集）
 * @param  {String|Number} where 插入位置
 * @return {Node|[Node]} 内容节点（集）
 */
function Insert( node, data, where ) {
    let _fun = insertHandles[where];

    if ( !_fun ) {
        throw new Error(`[${where}] is invalid method.`);
    }
    return _fun( node, data );
}


//
// 6种插入方式。
// @param  {Node|Element} node 目标节点。
// @param  {[Node|Element]} data 节点集
// @return {void}
//
const insertHandles = {
    // fill
    '': varyFill,

    // replace
    '0': (node, data) => varyNodes( node, 'replaceWith', data ),

    // before
    '1': (node, data) => varyNodes( node, 'before', data ),

    // after
    '-1': (node, data) => varyNodes( node, 'after', data ),

    // append
    // 表格容器非法内容时返回null（会自动异常）。
    '-2': (node, data) => varyNodes( trContainer(node, data), 'append', data ),

    // prepend
    '2': (node, data) => varyNodes( trContainer(node, data), 'prepend', data )
};


/**
 * 构建文档片段。
 * - 部分元素（script,style,link）默认会被排除。
 * - 源码解析异常会静默失败，返回null。
 * - 如果需要包含被排除的元素，可明确传递clean为非null。
 * @param  {String} html 源码
 * @param  {Document} doc 文档对象
 * @param  {Function} clean 文档片段清理器
 * @return {DocumentFragment} 文档片段
 */
function buildFragment( html, doc, clean ) {
    if (clean == null) {
        clean = cleanFragment
    }
    let _tpl = doc.createElement("template");
    _tpl.innerHTML = html;

    if ( ihtml.test(html) && isFunc(clean) ) {
        clean(_tpl.content);
    }
    return doc.adoptNode( _tpl.content );
}


// 待清除的元素和属性选择器。
// 专用于下面的清理函数：cleanFragment()。
const
    _cleanTags = clearTags.join(', '),
    _cleanAttrs = clearAttrs.map( v => `[${v}]` ).join(', ');


/**
 * 默认的文档片段清理器。
 * 移除几个脚本类元素和有安全风险的脚本属性。
 * 见：clearTags/clearAttrs 定义。
 * @param {DocumentFragment} frg 文档片段
 */
function cleanFragment( frg ) {
    let _els = $all( _cleanTags, frg );

    if (_els.length) {
        for (const el of _els) {
            el.remove();
        }
        window.console.warn('html-code contains forbidden tag! removed.');
    }
    _els = $all( _cleanAttrs, frg );

    if (_els.length) {
        for (const el of _els) {
            clearAttrs.forEach( n => el.removeAttribute(n) );
        }
        window.console.warn('html-code contains forbidden attribute! removed.');
    }
}


/**
 * 带清理的map处理。
 * 回调返回的 null|undefined 会被忽略。
 * @param  {[Value]|Iterator}} list 值集
 * @param  {Function} handle 处理器回调
 * @return {[Value]}
 */
function cleanMap( list, handle ) {
    let _buf = [];

    for (const [k, v] of list) {
        let _v = handle(v, k, list);
        if ( _v != null ) _buf.push( _v );
    }
    return _buf;
}


//
// 定制事件激发封装。
// - attr/prop/css/class
// - append/prepend/fill/before/after/replace
// - empty/remove/normalize
// - wrap/wrapinner/wrapall/unwrap
//////////////////////////////////////////////////////////////////////////////

// 事件名定义。
const
    evnAttrSet      = 'attrvary',
    evnAttrFail     = 'attrfail',
    evnAttrDone     = 'attrdone',
    evnPropSet      = 'propvary',
    evnPropFail     = 'propfail',
    evnPropDone     = 'propdone',
    evnCssSet       = 'cssvary',
    evnCssFail      = 'cssfail',
    evnCssDone      = 'cssdone',
    evnClassSet     = 'classvary',
    evnClassFail    = 'classfail',
    evnClassDone    = 'classdone',
    evnNodeVary     = 'nodevary',
    evnNodeFail     = 'nodefail',
    evnNodeDone     = 'nodedone';


/**
 * 激发定制事件（受限名称）。
 * 事件冒泡，不可取消。
 * @param  {Element} el 目标元素
 * @param  {String} evn 事件名
 * @param  {Array} data 发送数据
 * @return {Boolean} 是否已发送消息
 */
function limitTrigger( el, evn, data ) {
    return Options.varyevent && el.dispatchEvent(
        new CustomEvent( evn, {detail: data, bubbles: true, cancelable: false} )
    );
}


/**
 * 设置失败激发消息。
 * data结构：[错误对象, 新值, 旧值]。
 * @param  {Element} el 目标元素
 * @param  {String} evn 事件名
 * @param  {Array2} data 错误关联对象
 * @return {void}
 */
function failTrigger( el, evn, data ) {
    if ( !Options.varyevent ) {
        throw data[0];
    }
    el.dispatchEvent(
        new CustomEvent( evn, {detail: data, bubbles: true, cancelable: false} )
    );
}


/**
 * 移除特性（单个）。
 * 仅在目标特性存在时才会执行。
 * @param  {Element} el 目标元素
 * @param  {String} name 特性名（全）
 * @return {void}
 */
function removeAttr( el, name ) {
    if ( !el.hasAttribute(name) ) {
        return;
    }
    let _val = el.getAttribute( name );

    limitTrigger( el, evnAttrSet, [name, null] );
    el.removeAttribute( name );
    limitTrigger( el, evnAttrDone, [name, _val] );
}


/**
 * 移除特性集。
 * 事件递送消息中名称和值各为一个数组，按下标一一对应。
 * @param  {Element} el 目标元素
 * @param  {[String]} names 特性名序列
 * @return {void}
 */
function removeAttrs( el, names ) {
    let _vs = names.map(
            n => el.getAttribute( n )
        );
    limitTrigger( el, evnAttrSet, [names, null] );
    names.forEach(
        n => el.removeAttribute( n )
    );
    limitTrigger( el, evnAttrDone, [names, _vs] );
}


/**
 * 特性设置封装。
 * val传递null会删除特性本身，若特性名为布尔型，传递false也同样如此。
 * @param  {Element} el 目标元素
 * @param  {String} name 特性名（最终）
 * @param  {Value|null|false} val 特性值
 * @return {void}
 */
function setAttr( el, name, val ) {
    let _old = el.getAttribute(name);

    limitTrigger( el, evnAttrSet, [name, val] );
    try {
        el.setAttribute( name, val );
    }
    catch(e) {
        return failTrigger( el, evnAttrFail, [e, name, _old] );
    }
    limitTrigger( el, evnAttrDone, [name, _old] );
}


/**
 * 属性设置封装。
 * @param  {Element} el 目标元素
 * @param  {String} name 普通属性名
 * @param  {String} dname data属性名
 * @param  {Value} val 属性值
 * @return {void}
 */
function setProp( el, name, dname, val ) {
    let _old = elemProp._get(el, name, dname);

    limitTrigger( el, evnPropSet, [name, val] );
    try {
        if (dname) {
            el.dataset[ dname ] = val;
        } else {
            el[ propFix[name] || name ] = val;
        }
    }
    catch(e) {
        return failTrigger( el, evnPropFail, [e, name, _old] );
    }
    limitTrigger( el, evnPropDone, [name, _old] );
}


/**
 * 控件集选中清除。
 * 适用 input:checkbox|radio 类控件。
 * 注：
 * 非活动（disabled）控件的状态也会被清除。
 * 无 propfail 事件。
 * @param  {[Element]} els 控件组
 * @return {void}
 */
function clearChecked( els ) {
    for ( let e of els ) {
        let _old = e.checked;
        limitTrigger( e, evnPropSet, ['checked', false] );
        e.checked = false;
        limitTrigger( e, evnPropDone, ['checked', _old] );
    }
}


/**
 * select控件选取清除。
 * 无 propfail 事件。
 * 注：'select' 是一个定制属性名，仅用于<select>控件元素。
 * @param  {Element} el 控件元素
 * @return {void}
 */
function clearSelected( el ) {
    let _old = valHooks.select.get(el);

    limitTrigger( el, evnPropSet, ['select', null] );
    el.selectedIndex = -1;
    limitTrigger( el, evnPropDone, ['select', _old] );
}


/**
 * select控件操作（单选）。
 * 即便没有匹配项，原选中条目也会被清除选取。
 * 无 propfail 事件。
 * 注：'select' 是一个定制属性名，仅用于<select>控件元素。
 * @param  {Element} el 控件元素
 * @param  {Value} 对比值
 * @return {void}
 */
function selectOne( el, val ) {
    let _old = valHooks.select.get(el);

    limitTrigger( el, evnPropSet, ['select', val] );

    el.selectedIndex = -1;

    for ( const op of el.options ) {
        if ( op.value === val && !$is(op, ':disabled') ) {
            op.selected = true;
            break;
        }
    }
    limitTrigger( el, evnPropDone, ['select', _old] );
}


/**
 * select控件操作（多选）。
 * 匹配项被选取，非匹配项被清除选取。
 * 无 propfail 事件。
 * 注：'select' 是一个定制属性名，仅用于<select>控件元素。
 * @param  {Element} el 控件元素
 * @param  {Value|[Value]} 对比值/集
 * @return {void}
 */
function selects( el, val ) {
    let _old = valHooks.select.get(el);

    limitTrigger( el, evnPropSet, ['select', val] );

    el.selectedIndex = -1;

    if ( !isArr(val) ) {
        val = [val];
    }
    for ( const op of el.options ) {
        if ( !$is(op, ':disabled') ) {
            op.selected = val.includes( op.value );
        }
    }
    limitTrigger( el, evnPropDone, ['select', _old] );
}


/**
 * 样式设置封装。
 * @param  {Element} el 目标元素
 * @param  {String} name 样式名
 * @param  {Value} val 样式值
 * @return {void}
 */
function setStyle( el, name, val ) {
    let _old = getStyles(el)[name];

    limitTrigger( el, evnCssSet, [name, val] );
    try {
        el.style[name] = val;
    }
    catch(e) {
        return failTrigger( el, evnCssFail, [e, name, _old] );
    }
    limitTrigger( el, evnCssDone, [name, _old] );
}


/**
 * 类名添加封装。
 * 可一次添加多个名称，但仅发送一次事件。
 * @param  {Element} el 目标元素
 * @param  {[String]} names 类名集
 * @return {void}
 */
function addClass( el, names ) {
    let _old = Arr(el.classList);

    limitTrigger( el, evnClassSet, names );
    try {
        names.forEach( n => el.classList.add(n) );
    }
    catch(e) {
        return failTrigger( el, evnClassFail, [e, names, _old] );
    }
    limitTrigger( el, evnClassDone, _old );
}


/**
 * 类名删除封装。
 * 事件名同上。
 * 如果名称未传递或为null，会删除全部类名（移除class特性）。
 * 可一次删除多个名称，但仅发送一次事件。
 * @param  {Element} el 目标元素
 * @param  {[String]|null} names 类名集
 * @return {void}
 */
function removeClass( el, names ) {
    if ( names === null ) {
        return removeAttr( el, 'class' );
    }
    let _old = Arr(el.classList);

    limitTrigger( el, evnClassSet, names );
    try {
        names.forEach( n => el.classList.remove(n) );
    }
    catch(e) {
        return failTrigger( el, evnClassFail, [e, names, _old] );
    }
    limitTrigger( el, evnClassDone, _old );
}


/**
 * 类名切换封装。
 * 事件名同上（仅简单切换）。
 * @param  {Element} el 目标元素
 * @param  {[String]} names 类名集
 * @return {void}
 */
function toggleClass( el, names ) {
    let _old = Arr(el.classList);

    limitTrigger( el, evnClassSet, names );
    try {
        names.forEach( n => el.classList.toggle(n) );
    }
    catch(e) {
        return failTrigger( el, evnClassFail, [e, names, _old] );
    }
    limitTrigger( el, evnClassDone, _old );
}


/**
 * 类特性切换封装。
 * 事件名同上（针对整个class特性）。
 * @param {Element} el 目标元素
 * @param {String|null} val 设置值
 * @param {String|null} old 当前值
 */
function toggleClassAttr( el, val, old ) {
    if ( val === null ) {
        return removeAttr( el, 'class' );
    }
    limitTrigger( el, evnClassSet, val );
    try {
        el.setAttribute( 'class', val );
    }
    catch(e) {
        return failTrigger( el, evnClassFail, [e, val, old] );
    }
    limitTrigger( el, evnClassDone, old );
}


/**
 * 节点（集）的通用插入方法。
 * meth: append|prepend|before|after|replaceWith
 * @param  {Element} el 目标元素
 * @param  {String} meth 插入方法
 * @param  {Node|[Node]} nodes 数据节点（集）
 * @return {Node|[Node]} nodes
 */
function varyNodes( el, meth, nodes ) {
    if ( el === nodes ) {
        return el;
    }
    let _msg = {
            // replaceWith => replace
            type: meth.substring(0, 7),
            data: nodes,
        };

    limitTrigger( el, evnNodeVary, _msg );
    try {
        el[meth]( ...detachNodes(nodes) );
    }
    catch(e) {
        return failTrigger( el, evnNodeFail, [e, _msg])
    }
    limitTrigger( el, evnNodeDone, _msg );

    return nodes;
}


/**
 * 节点移除封装。
 * 事件目标：待移除节点父元素。
 * 如果节点无父元素（游离），不会产生任何行为。
 * 注：无 nodefail 事件。
 * @param  {Node} node 待移除节点
 * @param  {Element|null} box 待移除节点的父元素
 * @return {Node} node
 */
 function varyRemove( node, box ) {
    if ( box ) {
        let _msg = {
            type: 'remove',
            data: node,
        };
        limitTrigger( box, evnNodeVary, _msg );
        node.remove();
        limitTrigger( box, evnNodeDone, _msg );
    }
    return node;
}


/**
 * 元素内容清空封装。
 * 事件目标：容器元素自身。
 * 注：无 nodefail 事件。
 * @param  {Element} el 目标容器元素
 * @return {[Node]} 移除的节点集
 */
function varyEmpty( el ) {
    let _nodes = Arr(el.childNodes),
        _msg = {
            type: 'empty',
            data: _nodes,
        };
    limitTrigger( el, evnNodeVary, _msg );
    el.textContent = '';
    limitTrigger( el, evnNodeDone, _msg );

    return _nodes;
}


/**
 * 元素内容规范化封装。
 * 注：无 nodefail 事件。
 * @param  {Element} el 目标元素
 * @param  {Number} depth 影响的子元素深度
 * @return {Element} el
 */
function varyNormalize( el, depth ) {
    let _msg = {
            type: 'normalize',
            data: depth,
        };
    limitTrigger( el, evnNodeVary, _msg );
    el.normalize();
    limitTrigger( el, evnNodeDone, _msg );

    return el;
}


/**
 * 新节点（游离）插入封装。
 * meth: append|prepend|before
 * 注：没有 varyfail 事件。
 * @param  {Element} el 目标元素
 * @param  {String} meth 插入方法
 * @param  {Node} node 新节点（游离）
 * @return {Node} node
 */
function varyNewNode( el, meth, node ) {
    let _msg = {
            type: meth,
            data: node,
        };
    limitTrigger( el, evnNodeVary, _msg );
    el[meth]( node );
    limitTrigger( el, evnNodeDone, _msg );

    return node;
}


/**
 * 新节点（游离）集插入封装。
 * meth: append|prepend|before|replaceWith
 * 注：没有 varyfail 事件。
 * @param  {Element} el 目标元素
 * @param  {String} meth 插入方法
 * @param  {[Node]} nodes 新节点集（游离）
 * @return {[Node]} nodes
 */
function varyNewNodes( el, meth, nodes ) {
    let _msg = {
            type: meth.substring(0, 7),
            data: nodes,
        };
    limitTrigger( el, evnNodeVary, _msg );
    el[meth]( ...nodes );
    limitTrigger( el, evnNodeDone, _msg );

    return nodes;
}


/**
 * 子元素集删除封装。
 * 注：无 nodefail 事件。
 * @param  {Element} box 容器元素（tbody|thead|tfoot|tr|table）
 * @param  {[Element]} subs 待删除子元素集
 * @return {[Element]} 删除的子元素集
 */
function varyRemoves( subs, box ) {
    if ( box ) {
        let _msg = {
                type: 'removesiblings',
                data: subs,
            };
        limitTrigger( box, evnNodeVary, _msg );
        subs.forEach( nd => nd.remove() );
        limitTrigger( box, evnNodeDone, _msg );
    }
    return subs;
}


/**
 * 元素填充。
 * 包含事件：[empty, append]。
 * @param  {Element} el 目标元素
 * @param  {Node|[Node]} nodes 数据节点（集）
 * @return {Node|[Node]} nodes
 */
function varyFill( el, nodes ) {
    varyEmpty( el );
    return varyNodes( el, 'append', nodes );
}


/**
 * 节点包裹封装。
 * @param  {Node} node 被包裹节点
 * @param  {Element} root 封装根元素
 * @param  {Element} box 数据容器（插入点）
 * @return {Element} root 封装根容器
 */
function varyWrap( node, root, box ) {
    varyNodes( node, 'replaceWith', root );
    varyNodes( box, 'prepend', node );
    return root;
}


/**
 * 元素内容包裹封装。
 * @param  {Element} el 目标元素
 * @param  {Element} root 封装根元素
 * @param  {Element} box 数据容器（插入点）
 * @return {Element} 封装根容器
 */
function varyWrapInner( el, root, box ) {
    varyNodes(
        box,
        'prepend',
        varyEmpty(el) // 优化：只激发一次事件
    );
    return varyNodes( el, 'append', root );
}


/**
 * 集合被包裹封装。
 * 注：box包裹nodes，root替换nodes[0]的位置。
 * @param  {Element} root 封装根元素
 * @param  {Element} box 数据容器（插入点）
 * @param  {[Node]} nodes 节点集
 * @return {Element} 封装根容器
 */
function varyWrapAll( root, box, nodes ) {
    varyNodes( nodes[0], 'replaceWith', root );
    varyNodes( box, 'prepend', nodes );
    return root;
}


/**
 * 子元素插入封装。
 * 注：子元素是新建的游离元素。
 * @param  {Element} box 容器元素（tbody|thead|tfoot|tr|table）
 * @param  {Element} sub 子元素集
 * @param  {Element} ref 位置引用（前插），可选
 * @return {Element} 新插入的子元素
 */
function insertNode( box, sub, ref ) {
    return ref ?
        varyNewNode( ref, 'before', sub ) :
        varyNewNode( box, 'append', sub );
}


/**
 * 子元素集插入封装。
 * 注：子元素是新建的游离元素。
 * @param  {Element} box 容器元素（tbody|thead|tfoot|tr|table）
 * @param  {[Element]} subs 子元素集
 * @param  {Element} ref 位置引用（前插），可选
 * @return {[Element]} 新插入的子元素集
 */
function insertNodes( box, subs, ref ) {
    return ref ?
        varyNewNodes( ref, 'before', subs ) :
        varyNewNodes( box, 'append', subs );
}


/**
 * 让节点集脱离父元素。
 * @param  {Node|[Node]} nodes 节点（集）
 * @return {[Node]} 节点集
 */
function detachNodes( nodes ) {
    if ( nodes.nodeType ) {
        nodes = [nodes];
    }
    for (const nd of nodes) {
        varyRemove( nd, nd.parentElement );
    }
    return nodes;
}



//
// 特性（Attribute）操作封装。
// 包含对data-*系特性的处理。
//
const elemAttr = {
    /**
     * 获取特性值。
     * - 特性名可能为data系简写形式；
     * - 如果属性不存在，返回null；
     * @param  {Element} el 目标元素
     * @param  {String} name 特性名
     * @return {Value|null} 特性值
     */
    get( el, name ) {
        return boolAttr.test(name) ?
            boolHook.get( el, name ) : el.getAttribute( name );
    },


    /**
     * 设置特性。
     * - 部分属性为Boolean性质，特别处理（boolHook）。
     * - 特性名可能为data系简写形式。
     * - 如果value为null，则删除该特性。
     * @param {Element} el 目标元素
     * @param {String} name 特性名
     * @param {VAlue} value 设置值
     */
    set( el, name, value ) {
        return boolAttr.test(name) ?
            boolHook.set(el, name, value) : setAttr(el, name, value);
    },

};


//
// 属性（Property）操作封装。
// 包含对dataset系属性的处理。
//
const elemProp = {
    /**
     * 获取属性值。
     * - 属性名可能为data系简写形式。
     * @param  {Element} el  目标元素
     * @param  {String} name 属性名
     * @return {Value} 结果值
     */
    get( el, name ) {
        return this._get( el, name, dataName(name) );
    },


    //
    // @param {String} dname data-名称
    //
    _get( el, name, dname ) {
        if ( dname ) {
            return el.dataset[dname];
        }
        name = propFix[name] || name;
        let _hook = propHooks[name];

        return _hook ? _hook.get(el) : el[name];
    },


    /**
     * 设置属性。
     * @param {Element} el 目标元素
     * @param {String} name 属性名（支持data-简写）
     * @param {Value} value 设置值
     */
    set( el, name, val ) {
        return setProp( el, name, dataName(name), val );
    },

};



// from jQuery 3.x
const
    focusable = /^(?:input|select|textarea|button)$/i,
    propFix = {
        'for':   'htmlFor',
        'class': 'className',
        // 取消支持。
        // 由用户提供正确名称。一致性（驼峰名称不止这些）。
        // 'tabindex':          'tabIndex',
        // 'readonly':          'readOnly',
        // 'maxlength':         'maxLength',
        // 'cellspacing':       'cellSpacing',
        // 'cellpadding':       'cellPadding',
        // 'rowspan':           'rowSpan',
        // 'colspan':           'colSpan',
        // 'usemap':            'useMap',
        // 'frameborder':       'frameBorder',
        // 'contenteditable':   'contentEditable',
    },
    booleans = "checked|selected|async|autofocus|autoplay|controls|defer|disabled|hidden|ismap|loop|multiple|open|readonly|required|scoped",
    boolAttr = new RegExp("^(?:" + booleans + ")$", "i"),
    boolHook = {
        set: function( el, name, val ) {
            val === false ? removeAttr(el, name) : setAttr(el, name, name);
        },
        get: function( el, name ) {
            return el.hasAttribute(name) ? name : null;
        }
    };

const propHooks = {
    tabIndex: {
        get: function( el ) {
            return el.hasAttribute( "tabindex" ) || focusable.test( el.nodeName ) || el.href ?
                parseInt(el.tabIndex) || 0 :
                -1;
        }
    }
};


//
// 表单控件的取值/状态修改。
//
// 与元素的 value 属性或特性不同，这里的取值遵循表单提交逻辑。
// 即：如果条目未选中或自身处于 disabled 状态，返回 null。
//
// 对部分控件的设置是选中与值匹配的条目，而不是改变控件的值本身。
// 如果控件已 disabled，会忽略设置操作。
//
// 对于选取类控件，设置时传递 null 值会清除全部选取。
//
const valHooks = {

    // 会依所属组判断操作。
    radio: {
        // 返回选中项的值，仅一项。
        get: function( el ) {
            let _res = el.form[el.name];
            // form[undefined]有效，
            // 因此需对name再确认。
            return _res && el.name && this._get( _res.nodeType ? [_res] : _res );
        },

        _get: els => {
            for ( let e of els ) {
                if ( e.checked ) {
                    return $is( e, ':disabled' ) ? null : e.value;
                }
            }
            return null;
        },


        // val仅为值，不支持数组。
        // 注：采用严格相等比较。
        set: function( el, val ) {
            let _res = el.form[el.name];

            if (!_res || !el.name) {
                return;
            }
            return val === null ? clearChecked( $A(_res) ) : this._set( $A(_res), val );
        },

        _set: (els, val) => {
            for ( let e of els ) {
                if ( val === e.value ) {
                    return !$is(e, ':disabled') && setProp( e, 'checked', '', true );
                }
            }
        },
    },

    // 可能存在同名复选框。
    checkbox: {
        // 重名时始终返回一个数组（可能为空）。
        // 单独的复选框返回值或null（未选中）。
        get: function( el ) {
            let _cbs = el.form[el.name];
            // 检查name，预防作弊
            if ( !_cbs || !el.name ) {
                return;
            }
            if ( _cbs.nodeType ) {
                return _cbs.checked && !$is(_cbs, ':disabled') ? _cbs.value : null;
            }
            return this._get(_cbs);
        },

        _get: els => {
            let _buf = [];

            for ( let e of els ) {
                if ( e.checked && !$is(e, ':disabled') ) {
                    _buf.push( e.value );
                }
            }
            return _buf;
        },


        // 支持同名多复选，支持值数组匹配。
        set: function( el, val ) {
            let _cbs = el.form[el.name];

            if (!_cbs || !el.name) {
                return;
            }
            return val === null ?
                clearChecked( $A(_cbs) ) :
                this._set( $A(_cbs), isArr(val) ? val : [val] );
        },

        _set: (els, val) => {
            for ( let e of els ) {
                if ( !$is(e, ':disabled') ) setProp( e, 'checked', '', val.includes(e.value) );
            }
        },
    },

    select: {
        // 选中时返回一个值或值数组，否则返回null。
        get: function( el ) {
            if ( !(el = valPass(el)) ) {
                return el; // null/undefined
            }
            return el.type == 'select-one' ?
                this._get( el.options[el.selectedIndex] ) :
                this._gets( el.selectedOptions || el.options, [] );
        },

        _get: el => el && !$is(el, ':disabled') ? el.value : null,

        _gets: (els, buf) => {
            for ( const e of els ) {
                if ( e.selected && !$is(e, ':disabled') ) buf.push(e.value);
            }
            return buf;
        },


        // 多选列表支持一个匹配值数组。
        // 会清除其它已选取项。
        set: function( el, val ) {
            if (!valPass(el)) {
                return;
            }
            if (val === null) {
                return clearSelected(el);
            }
            return el.type == 'select-one' ? selectOne(el, val) : selects(el, val);
        },
    },

    // 占位。
    // 表单逻辑下不直接操作（由上层<select>实现）。
    option: {
        get: function() {},
        set: function() {},
    },

    // 默认操作。
    // 对目标元素value属性的直接操作。
    _default: {
        get: el => valPass(el) && el.value,
        set: (el, val) => valPass(el) && setProp( el, 'value', '', val )
    },
};



//
// boxSizing相关值。
//
const boxMargin = {
    height: cso => parseFloat(cso.marginTop) + parseFloat(cso.marginBottom),
    width:  cso => parseFloat(cso.marginLeft) + parseFloat(cso.marginRight)
};

const boxBorder = {
    height: cso => parseFloat(cso.borderTopWidth) + parseFloat(cso.borderBottomWidth),
    width:  cso => parseFloat(cso.borderLeftWidth) + parseFloat(cso.borderRightWidth)
};

const boxPadding = {
    height: cso => parseFloat(cso.paddingTop) + parseFloat(cso.paddingBottom),
    width:  cso => parseFloat(cso.paddingLeft) + parseFloat(cso.paddingRight)
};


//
// 矩形取值：目标差距。
//
const withRect = {
    height:      cso => boxPadding.height(cso) + boxBorder.height(cso),
    innerHeight: cso => boxBorder.height(cso),
    outerHeight: (cso, margin) => margin ? -boxMargin.height(cso) : 0,

    width:       cso => boxPadding.width(cso) + boxBorder.width(cso),
    innerWidth:  cso => boxBorder.width(cso),
    outerWidth:  (cso, margin) => margin ? -boxMargin.width(cso) : 0,
};


//
// CSS取值：目标差距。
//
const withCss = {
    height:      () => 0,
    innerHeight: cso => boxPadding.height(cso),
    outerHeight: (cso, margin) => boxPadding.height(cso) + boxBorder.height(cso) + (margin ? boxMargin.height(cso) : 0),

    width:       () => 0,
    innerWidth:  cso => boxPadding.width(cso),
    outerWidth:  (cso, margin) => boxPadding.width(cso) + boxBorder.width(cso) + (margin ? boxMargin.width(cso) : 0),
};


//
// 注记：
// - 未使用元素的offsetHeight属性；
// - 全部使用计算后样式值，浮点数；
//
const boxSizing = {
    // 内容盒模型。
    'content-box': {
        /**
         * 通用取值。
         * name为求值目标名称（height|innerHeight...）。
         * margin参数仅用于outer/Height|Width系求值。
         *
         * @param  {Element} el 目标元素
         * @param  {String} type 取值类型（height|width）
         * @param  {String} name 求值名称
         * @param  {CSSStyleDeclaration} cso 样式声明实例
         * @param  {Boolean} margin 包含Margin
         * @return {Number}
         */
        get: function( el, type, name, cso, margin ) {
            let _cv = parseFloat( cso[type] );
            return _cv ? _cv + withCss[name](cso, margin) : rectSize(el, type) - withRect[name](cso, margin);
        },


        /**
         * 设置高宽值。
         * @param {Element} el 目标元素
         * @param {String} name 设置类型名（height|width）
         * @param {Number} val 设置的值
         */
        set: ( el, name, val ) => {
            el.style[name] = isNumeric(val) ? val+'px' : val;
        },
    },


    // 边框盒模型。
    'border-box': {
        /**
         * 通用取值（参数说明同上）。
         */
        get: function( el, type, name, cso, margin ) {
            return ( parseFloat( cso[type] ) || rectSize(el, type) ) - withRect[name](cso, margin);
        },


        /**
         * 返回非0值表示需要二次设置。
         * - val非数值或像素单位时先试探性设置，返回补充高度。
         * - 仅用于height/width。
         * 注：非像素单位难以转换计算，故用此方法。
         * @param  {String} name 设置类型名（height|width）
         * @param  {String|Number} val
         * @return {Number}
         */
        set: ( el, name, val, cso ) => {
            let _pb2 = boxPadding[name](cso) + boxBorder[name](cso),
                _num = pixelNumber(val);

            el.style[name] = _num ? (_num + _pb2 + 'px') : val;
            return _num ? 0 : _pb2;
        },
    }
};


/**
 * 测试元素val接口通过性。
 * 注：无name属性和被disabled返回值不同。
 * @param  {Element} el 测试元素
 * @return {Element|null|undefined}
 */
function valPass( el ) {
    if (!el.hasAttribute('name')) {
        return;
    }
    return $is(el, ':disabled') ? null : el;
}


/**
 * 矩形高宽值。
 * - 取矩形尺寸，已经包含了边框和内补丁；
 * - 用于CSS里高宽值为auto时（inline）的情形；
 * @param  {Element} el 目标元素
 * @param  {String} name 取值类型（height|width）
 * @return {Number}
 */
function rectSize( el, name ) {
    return el.getClientRects().length && el.getBoundingClientRect()[name];
}




//
// 事件处理接口。
// 事件处理器：function(event, elo): false|Any
// elo: {
//      target: Element   事件起源元素（event.target）
//      current: Element  触发处理器调用的元素（event.currentTarget或slr匹配的元素）
//      selector: String  委托匹配选择器
//      delegate: Element 绑定委托的元素（event.currentTarget）
// }
// 注：
// 暂不支持用户指定capture（捕获）参数。
// 如果绑定不是委托方式，selector值为null。
//
//////////////////////////////////////////////////////////////////////////////

const Event = {
    //
    // 绑定记录。
    // 与绑定事件处理器的当前元素相关联：WeakMap{ Element: Map }
    // Map{
    //      evname: Map{
    //          selector: Map{
    //              handle: [ bound, capture, once ]
    //              //        封装调用, 为捕获, 单次
    //          }
    //      }
    // }
    // 同一个元素上“相同事件名/选择器/用户句柄”只能绑定一次。
    //
    store: new WeakMap(),


    //
    // 会创建原生事件的方法。
    // 说明：
    // 元素上的部分方法调用会创建一个原生事件，它们需在此明列。
    // 这些方法通常有着相应的浏览器/DOM逻辑，如：
    // - select 选取表单控件内的文本。
    // - click  选中或取消选中checkbox/radio表单控件条目。
    // - focus  表单控件的聚焦。
    // trigger会直接调用它们触发原生事件，而不是构造一个自定义事件发送。
    // 注意：
    // form:submit() 和 video:load() 只是普通方法，不创建事件。
    // 元素的其它普通方法也可以被激发，但都需要预先绑定处理器（不可出现在此）。
    //
    nativeEvents: new Set([
        'blur',
        'click',
        'focus',
        'pause',    // audio, video
        'play',     // audio, video
        'reset',    // form
        'scroll',
        'select',   // textarea, input:text
    ]),


    //
    // 捕获定义。
    // 非冒泡事件，委托时注册为捕获。
    //
    captures: {
        focus:      true,
        blur:       true,
        mouseenter: true,
        mouseleave: true,

        // 元素的该事件不冒泡，window上的该事件冒泡。
        // 统一注册为捕获。
        scroll:     true,
    },


    //
    // 委托绑定转交。
    // 部分浏览器不支持focusin/focusout。
    //
    sendon: {
        focusin:    'focus',
        focusout:   'blur',
    },


    //
    // 起点元素标记前缀。
    // 用于委托选择器的前置标识，表示仅测试事件起点元素。
    //
    originPrefix: '~',


    /**
     * 绑定事件调用。
     * @param {Element} el 目标元素
     * @param {String} evn 事件名
     * @param {String} slr 委托选择器，可选
     * @param {Function|Object} handle 用户处理函数/对象
     */
    on( el, evn, slr, handle ) {
        let [_evn, _cap] = this._evncap(evn, slr),
            [_slr, _get] = this.matches(slr);

        if ( this.isBound(el, _evn, _slr, handle) ) {
            return this;
        }
        let _bound = this._handler(handle, _get, _slr);

        el.addEventListener(
            _evn,
            this.setBuffer( this.buffer(el, _evn, _slr), handle, _bound, _cap, false ),
            _cap
        );
        return this;
    },


    /**
     * 单次绑定执行。
     * - 执行一次之后自动删除绑定。
     * - 连续的多次绑定是有效的。
     * @param {Element} el 目标元素
     * @param {String} evn 事件名
     * @param {String} slr 委托选择器，可选
     * @param {Function|Object} handle 用户处理函数/对象
     */
    one( el, evn, slr, handle ) {
        let [_evn, _cap] = this._evncap(evn, slr),
            [_slr, _get] = this.matches(slr);

        if ( this.isBound(el, _evn, _slr, handle) ) {
            return this;
        }
        let _pool = this.buffer(el, _evn, _slr),
            // 存储普通封装（便于clone）。
            _bound = this.setBuffer(_pool, handle, this._handler(handle, _get, _slr), _cap, true);

        el.addEventListener(
            _evn,
            this._onceHandler( el, _evn, _bound, _cap, _pool, handle ),
            _cap
        );
        return this;
    },


    /**
     * 解除事件绑定。
     * - 解除绑定的同时会移除相应的存储记录（包括单次绑定）。
     *   即：单次绑定在调用之前可以被解除绑定。
     * - 传递事件名为假值会解除元素全部的事件绑定。
     * - slr的含义参考接口 $.off() 说明。
     * @param {Element} el 目标元素
     * @param {String} evn 事件名
     * @param {String} slr 委托选择器，可选
     * @param {Function|Object} handle 处理函数/对象，可选
     */
    off( el, evn, slr, handle ) {
        let _m1 = this.store.get(el);

        if ( _m1 ) {
            if ( !evn ) {
                this._clearAll( el, _m1 );
            } else {
                this._clearSome( el, _m1, evn, slr, handle );
            }
            if (_m1.size == 0) {
                this.store.delete(el);
            }
        }
        return this;
    },


    /**
     * 事件绑定克隆。
     * 可以传递事件名序列，只克隆相应事件名的绑定。
     * 如果没有传递事件名集，则全部事件绑定都会克隆。
     * 注记：
     * 事件处理器和事件配置会共享同一个对象。
     * @param  {Element} to  目标元素
     * @param  {Element} src 事件源元素
     * @param  {[String]|Function} evns 事件名序列或过滤回调，可选
     * @return {Element} to
     */
    clone( to, src, evns ) {
        if ( !this.store.has(src) ) {
            return to;
        }
        let _fltr = this._compRecord(evns);

        for (const [n, nm] of this.store.get(src)) {
            // n:ev-name
            for (const [s, sm] of nm) {
                // s:selector
                for (const [h, v3] of sm) {
                    // h:handle
                    if ( _fltr(n, s, h ) ) {
                        let _pool = this.buffer( to, n, s );
                        to.addEventListener(
                            n,
                            v3[2] ? this._onceHandler(to, n, v3[0], v3[1], _pool, h) : v3[0],
                            v3[1]
                        );
                    }
                }
            }
        }
        return to;
    },


    /**
     * 获取记录缓存。
     * 如果不存在中间存储区会自动创建。
     * @param  {Element} el 目标元素
     * @param  {String} evn 事件名
     * @param  {String} slr 委托选择器
     * @return {Map} 末端存储 {handle: Array3}
     */
    buffer( el, evn, slr ) {
        return this._map( this._map( this._map( this.store, el ), evn ), slr )
    },


    /**
     * 设置绑定记录。
     * 最终存储集：Map{ handle: [bound, capture, once] }。
     * @param  {Map} pool 末端存储池
     * @param  {Function} handle 用户处理句柄
     * @param  {Function} bound 普通封装句柄
     * @param  {Boolean} capture 是否为捕获
     * @param  {Boolean} once 是否为单次
     * @return {Function} bound
     */
    setBuffer( pool, handle, bound, capture, once ) {
        pool.set(
            handle,
            [bound, capture, once]
        );
        return bound;
    },


    /**
     * 是否已绑定。
     * @param  {String} evn 事件名
     * @param  {String} slr 委托选择器
     * @param  {Function|EventListener} handle 用户句柄
     * @return {Boolean}
     */
    isBound( el, evn, slr, handle ) {
        let _m1 = this.store.get(el),
            _m2 = _m1 && _m1.get(evn),
            _m3 = _m2 && _m2.get(slr);

        return !!_m3 && _m3.has(handle);
    },


    /**
     * 获取匹配选择器和匹配句柄。
     * 主要用于区分委托模式下的匹配类型（起点匹配或搜寻匹配）。
     * @param  {String} slr 选择器
     * @return {[String, Function]} 合法选择器和匹配函数
     */
    matches( slr ) {
        if ( !slr ) {
            return [ null, this._current ];
        }
        if ( slr[0] == this.originPrefix) {
            return [ slr.substring(1), this._target ];
        }
        return [ slr, this._delegate ];
    },


    /**
     * 是否为可调用事件。
     * 即由元素上原生事件函数调用触发的事件。
     * @param  {String} evn 事件名
     * @return {Boolean}
     */
    callable( evn ) {
        return this.nativeEvents.has(evn);
    },


    /**
     * 特例：false处理器。
     * 停止事件默认行为，用于用户简单注册。
     */
    falseHandle( ev ) {
        ev.preventDefault();
        return false;
    },


    /**
     * 特例：null处理器。
     * 停止事件默认行为并停止冒泡，用于用户简单注册。
     * @param {Event} ev 事件对象
     */
    nullHandle( ev ) {
        ev.preventDefault();
        ev.stopPropagation();
        return false;
    },


    //-- 私有辅助 -------------------------------------------------------------


    /**
     * 构造事件处理句柄。
     * - 返回的函数由事件实际触发调用：func(ev)
     * - 每次返回的是一个新的处理函数。
     * - 支持EventListener接口，此时this为接口实现对象自身。
     * 注意：
     * 用户传入的事件处理器函数内的this没有特殊含义（并不指向event.currentTarget）。
     *
     * @param  {Function} handle 用户调用
     * @param  {Function} current 获取当前元素的函数
     * @param  {String|null} slr 选择器串（已合法）
     * @return {Function} 处理器函数
     */
    _handler( handle, current, slr ) {
        if ( !isFunc(handle) ) {
            // EventListener
            handle = handle.handleEvent.bind(handle);
        }
        return this._wrapCall.bind(this, handle, current, slr);
    },


    /**
     * 构造单次调用处理器。
     * 执行之后会自动移除绑定和配置存储。
     * @param  {Element} el 目标元素
     * @param  {String} evn 事件名
     * @param  {Function} bound 普通封装处理器
     * @param  {Boolean} cap 是否为捕获
     * @param  {Map} pool 末端存储器
     * @param  {Function} handle 用户处理器
     * @return {Function} 封装处理器（单次逻辑）
     */
    _onceHandler( el, evn, bound, cap, pool, handle ) {
        return function caller(...args) {
            pool.delete(handle);
            el.removeEventListener(evn, caller, cap);
            return bound(...args);
        };
    },


    /**
     * 处理器封装。
     * - 普通函数处理器内的this无特殊意义。
     * - 处理器返回false可以阻止原生非事件类方法的调用（trigger）。
     * @param  {Function} handle 用户处理函数
     * @param  {Function} current 获取当前元素的函数
     * @param  {String|null} slr 委托选择器（已合法）
     * @param  {Event} ev 原生事件对象
     * @return {Boolean}
     */
    _wrapCall( handle, current, slr, ev ) {
        let _cur = current( ev, slr ),
            _elo = _cur && {
                target:     ev.target,
                current:    _cur,
                selector:   slr || null,
                delegate:   ev.currentTarget,
            }
        // 需要调用元素的原生方法完成浏览器逻辑，
        // 如：form:submit, video:load 等。
        return _elo && handle(ev, _elo) !== false && this._methodCall(ev, _elo.current);
    },


    /**
     * 元素上方法调用。
     * 主要为trigger激发原生方法的DOM逻辑完成。
     * 如：form:submit()，它不会产生一个submit事件。
     * 也可用于普通方法，传递定制数据（ev.detail）为其实参。
     * @param {Event} ev 事件对象
     * @param {Element} el 目标元素
     */
    _methodCall( ev, el ) {
        let _evn = ev.type,
            _fun = el[_evn];

        if (ev.defaultPrevented ||
            // 避免循环触发。
            this.callable(_evn) ||
            !isFunc(_fun) ) {
            return;
        }
        return _fun.bind(el)( ...(isArr(ev.detail) ? ev.detail : [ev.detail]) );
    },


    /**
     * 构造检测过滤函数集。
     * 过滤函数接口：function(evn, slr, handle): Boolean。
     * 三个检查条件可任意组合。
     * slr明确地传递null仅匹配非委托绑定，
     * 如果需要匹配任意委托绑定，slr可传递空串值。
     *
     * @param  {String} evn 事件名
     * @param  {String} slr 选择器，可选
     * @param  {Function|Object} handle 用户调用句柄/对象，可选
     * @return {[Function]} 过滤函数集
     */
    _filter( evn, slr, handle ) {
        let _fns = [ n => n == evn ];

        if ( slr || slr === null ) {
            _fns.push( (n, s) => s === slr );
        }
        if ( handle ) {
            _fns.push( (n, s, h) => h === handle );
        }
        return _fns.length == 1 ? _fns[0] : (n, s, h) => _fns.every(f => f(n, s, h));
    },


    /**
     * 事件原始记录匹配器。
     * @param  {[String]} evns 匹配事件名集
     * @return {Function} 匹配函数
     */
    _compRecord( evns ) {
        if ( !evns ) {
            return () => true;
        }
        if ( isFunc(evns) ) {
            return evns;
        }
        return name => evns.includes( name );
    },


    /**
     * 获取目标键的存储集。
     * 如果目标存储集不存在则新建。
     * @param  {Map} pool 存储集
     * @param  {String|Function|EventListener} key 存储键
     * @return {Map} 目标存储集
     */
    _map( pool, key ) {
        let _v = pool.get(key);

        if ( !_v ) {
            pool.set( key, _v = new Map() );
        }
        return _v;
    },


    /**
     * 解除事件绑定（全部）。
     * @param  {Element} el 目标元素
     * @param  {Map} map1 一级存储集
     * @return {void}
     */
    _clearAll( el, map1 ) {
        for (let [n, m2] of map1) {
            for (const m3 of m2.values()) {
                for (const av of m3.values()) {
                    el.removeEventListener( n, av[0], av[1] );
                }
            }
        }
        map1.clear();
    },


    /**
     * 解除事件绑定（指定事件名）。
     * Map: { bound-handler: {event, handle, selector, once} }
     * @param  {Element} el 目标元素
     * @param  {Map} map1 一级存储集
     * @param  {String} evn 事件名
     * @param  {String} slr 委托选择器，可选
     * @param  {Function|Object} handle 处理函数/对象，可选
     * @return {void}
     */
    _clearSome( el, map1, evn, slr, handle ) {
        let _fltr = this._filter(evn, slr, handle);

        for (let [n, m2] of map1) {
            for (const [s, m3] of m2) {
                for (const [h, av] of m3) {
                    if ( _fltr(n, s, h) ) {
                        el.removeEventListener( n, av[0], av[1] );
                        m3.delete( h );
                    }
                }
                if ( m3.size == 0 ) m2.delete( s );
            }
            if ( m2.size == 0 ) map1.delete( n );
        }
    },


    /**
     * 获取事件名与捕获模式。
     * - 根据是否委托返回调整后的值；
     * 注：仅在委托模式下才需要调整事件名和捕获模式；
     * @param  {String} evn 原始事件名
     * @param  {String} slr 选择器
     * @return {[String, Boolean]} [事件名，是否为捕获]
     */
    _evncap( evn, slr ) {
        if (slr) {
            evn = this.sendon[evn] || evn;
        }
        return [ evn, slr ? !!this.captures[evn] : false ];
    },


    /**
     * 起点目标匹配。
     * 仅用于委托模式下的选择器匹配。
     * 用于优化委托模式下的单一检测（不再向上尝试匹配）。
     * @param  {Event} ev 事件对象
     * @param  {String} slr 合法的选择器串
     * @return {Element|null}
     */
    _target( ev, slr ) {
        let _el = ev.target;

        if ( !subslr.test(slr) ) {
            return $is(_el, slr) ? _el : null;
        }
        let _box = ev.currentTarget;
        try {
            hackAttr(_box, hackFix);
            return $is( _el, hackSelector(_box, slr, hackFix) ) ? _el : null;
        }
        finally {
            hackAttrClear(_box, hackFix);
        }
    },


    /**
     * 获取当前元素。
     * 注：非委托模式下的匹配。
     * @param {Event} ev 事件对象
     */
    _current( ev ) {
        return ev.currentTarget;
    },


    /**
     * 委托目标匹配。
     * 只返回最深的匹配元素（含target），因此事件处理最多一次。
     * 委托匹配不测试绑定元素自身。
     *
     * 仅匹配一次的理由：
     * 1. 解除与标签结构的紧密相关性，上层标签修改不会无意中触发多次调用。
     * 2. 在节点树上沿路径连串触发事件处理不是一个常见场景。
     * 3. 简化和性能考虑，也是设计逻辑的选择。
     * 注：
     * 事件处理器的第二个实参对象中包含了委托元素和选择器，
     * 如果必要，处理器可以自行向上检索匹配元素激发事件或直接处理。
     *
     * @param  {Event} ev 原生事件对象
     * @param  {String} slr 选择器
     * @return {Element|null} 匹配元素
     */
    _delegate( ev, slr ) {
        let _beg = ev.target,
            _box = ev.currentTarget;

        if ( !subslr.test(slr) ) {
            return closest(_box, _beg, slr);
        }
        try {
            hackAttr(_box, hackFix);
            return closest(_box, _beg, hackSelector(_box, slr, hackFix));
        }
        finally {
            hackAttrClear(_box, hackFix);
        }
    },

};


/**
 * 向上检测匹配。
 * 专用于委托绑定时，向上递进到委托容器时止。
 * 注：不包含容器本身。
 * @param  {Element} box 容器元素
 * @param  {Element} beg 匹配起点元素
 * @param  {String} slr 选择器串（已合法）
 * @return {Element|null} 匹配的子级元素
 */
function closest( box, beg, slr ) {
    while ( beg !== box ) {
        if ( $is(beg, slr) ) return beg;
        beg = beg.parentNode;
    }
    return null;
}


/**
 * 惯用处理器封装。
 * 对两个简单的值（false|null）封装为相应的处理器。
 * 仅用户友好（语法糖）。
 * @param  {String|Object} 事件名或配置对象
 * @param  {Function|false|null} handle 用户处理器
 * @return {[String|Object, Function|EventListener]}
 */
function customHandles( evn, handle ) {
    return typeof evn == 'string' ?
        [ evn, customHandle( handle ) ] :
        [ tQuery.each( evn, (fn, k) => evn[k] = customHandle(fn) ), null ];
}


/**
 * 惯用处理器封装。
 * 对两个简单的值（false|null）封装为相应的处理器。
 * 仅用户友好（语法糖）。
 * @param  {String|Object} 事件名或配置对象
 * @param  {Function|false|null} handle 用户处理器
 * @return {Function|Object}
 */
function customHandle( handle ) {
    switch (handle) {
        case null:
            return Event.nullHandle;
        case false:
            return Event.falseHandle;
    }
    return handle;
}


/**
 * 事件批量绑定/解绑。
 * - 用于事件的on/off/one批量操作。
 * - evn支持“事件名序列: 处理函数”配置对象，此时slr依然有效（全局适用）。
 * @param  {String} type 操作类型（on|off|one）
 * @param  {Element} el  目标元素
 * @param  {String} slr  委托选择器
 * @param  {String|Object} evn 事件名（序列）或配置对象
 * @param  {Function} handle 事件处理函数
 * @return {void}
 */
function eventBinds( type, el, slr, evn, handle ) {
    if (! el) {
        throw new Error(`el is ${el}.`);
    }
    if (typeof evn == 'string') {
        return evnsBatch( type, el, evn, slr, handle );
    }
    for ( let [n, f] of Object.entries(evn) ) evnsBatch(type, el, n, slr, f);
}


/**
 * 批量绑定/解绑（事件名序列）。
 * - 多个事件名对应于一个处理函数；
 * @param {String} type 操作类型（on|off|one）
 * @param {Element} el  目标元素
 * @param {String} evn  事件名（序列）
 * @param {String} slr  委托选择器
 * @param {Function} handle 事件处理函数
 */
function evnsBatch( type, el, evn, slr, handle ) {
    evn.split(__reSpace)
        .forEach( name => Event[type](el, name, slr, handle) );
}


//
// 就绪载入部分。
// 相关接口：tQuery.ready, tQuery.holdReady
///////////////////////////////////

const domReady = {
    //
    // 基本成员/状态。
    //
    bounds: [],     // 绑定句柄集
    waits:  0,      // 就绪等待
    passed: false,  // 就绪已调用
    loaded: false,  // 文档已载入（DOMContentLoaded）


    /**
     * 文档载入就绪调用。
     * 如果就绪调用已实施，新的绑定立即执行。
     */
    ready() {
        if (this.waits) {
            return;
        }
        while (this.bounds.length) this.bounds.shift()();
        this.passed = true;
    },


    /**
     * 绑定就绪操作。
     * 如果文档已载入完毕，立即尝试就绪调用；
     * @param {Function} handle 用户就绪调用
     * @param {Function} bound 待绑定的处理函数
     */
    bind( handle, bound ) {
        this.bounds.push(
            () => this.completed(handle, bound)
        );
        document.addEventListener( "DOMContentLoaded", bound );
        window.addEventListener( "load", bound );

        return this.loaded && this.ready();
    },


    /**
     * 绑定释放并最终调用。
     * @param {Function} handle 用户就绪调用
     * @param {Function} bound  绑定句柄
     */
    completed( handle, bound ) {
        window.removeEventListener( "load", bound );
        document.removeEventListener( "DOMContentLoaded", bound );
        return handle && handle(tQuery);
    },

};



/**
 * 对象成员处理赋值。
 * 对数据源的每个成员用处理器处理，结果赋值到目标对象。
 * 接口：function(v, k, source, target): [v, k] | null
 * 返回假值忽略赋值，这提供了一种排除机制。
 * 注：
 * 这是一种浅赋值，相同的键会被后来者覆盖。
 * 属性仅为自身所有，且排除了不可枚举类型（同 Object.assign 行为）。
 *
 * @param  {Object} to 目标对象
 * @param  {Object} src 数据源对象
 * @param  {Function} proc 处理器函数
 * @return {Object} to
 */
 function assignProc( to, src, proc ) {

    for (const k of Reflect.ownKeys(src)) {
        if ( src.propertyIsEnumerable(k) ) {
            let _v = proc(
                src[k], k, src, to
            );
            if ( _v ) to[ _v[1] == null ? k : _v[1] ] = _v[0];
        }
    }
    return to;
}



//
// 实用工具集
///////////////////////////////////////////////////////////////////////////////


tQuery.isArray      = isArr;
tQuery.isNumeric    = isNumeric;
tQuery.isFunction   = isFunc;
tQuery.isCollector  = isCollector;
tQuery.dataName     = dataName;
tQuery.is           = $is;
tQuery.type         = $type;


Object.assign( tQuery, {
    /**
     * 通用遍历。
     * - 回调返回false会终止遍历。
     * - 适用于数组、Map/Set、普通对象和任何包含.entries接口的实例。
     * - 注：Collector 集合版可直接使用该接口。
     * handle：(
     *      value,  值/元素,
     *      key,    键/下标,
     *      obj,    迭代对象自身
     * )
     * 注：参数与数组forEach标准接口类似，this由外部传入。
     *
     * @param  {Array|Object|[.entries]|Collector} obj 迭代目标
     * @param  {Function} handle 迭代回调（val, key）
     * @param  {Any} thisObj 迭代回调内的this
     * @return {obj} 迭代的目标对象
     */
    each( obj, handle, thisObj ) {
        if ( thisObj !== undefined ) {
            handle = handle.bind(thisObj);
        }
        for ( let [k, v] of entries(obj) ) {
            if (handle(v, k, obj) === false) break;
        }
        return obj;
    },


    /**
     * 集合操作。
     * - 支持.entries接口的内置对象包括Map,Set系列。
     * - 回调返回undefined或null的条目被忽略。
     * - 回调接口：function(val, key, iter): Value
     * @param  {[Value]|Object|.entries} iter 迭代目标
     * @param  {Function} fun 转换函数
     * @param  {Any} thisObj 回调内的this
     * @return {[Value]}
     */
    map( iter, fun, thisObj ) {
        return cleanMap(
            entries(iter),
            thisObj === undefined ? fun : fun.bind(thisObj)
        );
    },


    /**
     * 全部为真。
     * 参考iterSome。
     * @param  {[Value]|Object|.entries} iter 迭代目标
     * @param  {Function} comp 比较函数
     * @param  {Object} thisObj 回调内的this
     * @return {Boolean}
     */
    every( iter, comp, thisObj ) {
        if ( thisObj !== undefined ) {
            comp = comp.bind(thisObj);
        }
        for ( let [k, v] of entries(iter) ) {
            if (!comp(v, k, iter)) return false;
        }
        return true;
    },


    /**
     * 某一为真。
     * - 类似数组同名函数功能，扩展到普通对象。
     * - 适用数组/普通对象/.entries接口对象。
     * - 比较函数接收值/键两个参数，类似each。
     * @param  {[Value]|Object|.entries} iter 迭代目标
     * @param  {Function} comp 比较函数
     * @param  {Object} thisObj 回调内的this
     * @return {Boolean}
     */
    some( iter, comp, thisObj ) {
        if ( thisObj !== undefined ) {
            comp = comp.bind(thisObj);
        }
        for ( let [k, v] of entries(iter) ) {
            if (comp(v, k, iter)) return true;
        }
        return false;
    },


    /**
     * 封装用户函数包含一个自动计数器。
     * - 用户函数的首个实参为计数值，会自动递增。
     * - 接口：function( count, ... )
     *
     * 注记：
     * 单元素版接口中部分参数支持用户回调处理器，
     * 但这些处理器难以获得集合版的当前单元计数（集合版通常只是单元素版的简单重复），
     * 所以这里提供一个封装工具，用于集合版中用户的回调处理。
     *
     * @param {Function} fn 用户处理器
     * @param {Number} n 计数起始值，可选
     * @param {Number} step 计数步进值，可选
     * @return {Function} 含计数器的处理器
     */
    Counter( fn, n = 1, step = 1 ) {
        n -= step;
        return (...rest) => fn( (n += step), ...rest );
    },


    /**
     * 构造选择器。
     * 主要用于属性选择器构造。
     * op: {
     *      ~   空格分隔的单词匹配
     *      |   -分隔的词组前置匹配
     *      *   字串包含匹配
     *      ^   头部字串匹配
     *      $   尾部字串匹配
     * }
     * @param  {String} tag  标签名
     * @param  {String} attr 属性名，可选
     * @param  {String} val  属性值，可选
     * @param  {String} op   属性匹配符，可选
     * @return {String}
     */
    slr( tag, attr = '', val = '', op = '' ) {
        if ( !attr ) {
            return tag;
        }
        return `${tag || ''}[${attrName(attr)}` + (val && `${op}="${val}"`) + ']';
    },


    /**
     * 源码标签化。
     * 将非 <> 包围的代码转为正常的HTML标签源码。
     * 如：[a href="#"]some link[/a] 转为 <a href="#">some link</a>
     * 注：仅仅就是对包围字符进行简单的替换。
     * @param  {String} code 待转换代码
     * @return {String} 包含标签的字符串
     */
    tags( code ) {
        return code.
            replace(tagLeft, '$1<').replace(tagLeft0, '[').
            replace(tagRight, '$1>').replace(tagRight0, ']');
    },


    /**
     * 字符串切分。
     * 支持4子节Unicode字符的空串切分。
     * 注：修复String.split()行为。
     * @param {String} str 目标字符串
     * @param {String|RegExp} sep 切分字符串或模式
     */
    split( str, sep, cnt ) {
        return sep ? str.split( sep, cnt ) : str.split( /(?:)/u, cnt );
    },


    /**
     * Map转换为键值索引对二元对象数组。
     * 每一个键/值对转换为一个二元对象。
     * 即：{
     *      [name]: map.key,
     *      [value]: map.value
     * }
     * 全部的键/值对的二元对象构成一个数组。
     *
     * @param  {Map} map Map实例
     * @param  {String} kname 键名称
     * @param  {String} vname 值名称
     * @return {[Object2]} 键值索引对对象数组
     */
    kvsMap( map, kname = 'name', vname = 'value' ) {
        let _buf = [];

        for (const [k, v] of map) {
            _buf.push({ [kname]: k, [vname]: v });
        }
        return _buf;
        // return [...map].map( kv => ({ [kname]: kv[0], [vname]: kv[1] }) );
    },


    /**
     * 多数组合并。
     * - 将后续数组或数据合并到第一个数组；
     * - 如果数据来源不是数组，直接添加为成员；
     * - 返回首个参数数组本身；
     * @param  {Array} des 目标数组
     * @param  {Array} src 数据源集序列
     * @return {Array} des
     */
    mergeArray( des, ...src ) {
        des.push( ...arrFlat(src) );
        return des;
    },


    /**
     * 对象成员赋值（可过滤）。
     * 对数据源的每个成员用处理器处理，结果赋值到目标对象。
     * 处理器：
     *      function(v, k, source, target): [v, k] | null
     * 返回值：
     * - [v，k] 值/键的二元数组，其中键可选。
     * - null   也可以是其它假值，该条目的赋值会被忽略。
     * 注：
     * 最后一个实参为处理器，但也可以是普通对象（即普通赋值）。
     * 会迭代源对象自身每一个可枚举属性，包括 Symbol 类型。
     *
     * @param  {Object} target 目标对象
     * @param  {...Object} sources 数据源对象序列
     * @param  {Object|Function} _fx 数据源对象或处理器
     * @return {Object} target
     */
    assign( target, ...sources ) {
        let _fx = sources.pop();

        if ( isFunc(_fx) && sources.length ) {
            return sources.reduce( (to, src) => assignProc(to, src, _fx), target );
        }
        return Object.assign( target, ...sources, _fx );
    },


    /**
     * 创建一个新的对象。
     * - 新对象基于首个参数base为原型。
     * - 新对象是后续对象的浅拷贝合并。
     * @param  {Object} base 原型对象
     * @param  {Object} data 源数据序列
     * @return {Object}
     */
    object( base, ...data ) {
        return Object.assign( Object.create(base || null), ...data );
    },


    /**
     * 获取：对象的原型
     * 设置：设置对象的原型并返回该对象。
     * @param  {Object} obj  目标对象
     * @param  {Object} base 原型对象
     * @return {Object} obj
     */
    proto( obj, base ) {
        return base === undefined ?
            Object.getPrototypeOf(obj) : Object.setPrototypeOf(obj, base);
    },


    /**
     * 构造范围序列
     * - 序列为[beg : beg+size)，半开区间。
     * - 如果beg为字符，则构造Uncode范围序列。
     * - 构造字符范围时，size可为终点字符（包含自身）。
     * @param  {Number|String} beg 起始值
     * @param  {Number|String} size 序列长度或终点字符
     * @param  {Number} step 增量步进值，可选
     * @return {Iterator|null} 序列生成器
     */
    range( beg, size, step = 1 ) {
        return typeof beg == 'number' ?
            rangeNumber( beg, size, step ) : rangeChar( beg.codePointAt(0), size, step );
    },


    /**
     * 当前时间毫秒数。
     * - 自纪元（1970-01-01T00:00:00）开始后的毫秒数（与时区无关）；
     * - 传递json为真，返回JSON标准格式串；
     * @param  {Boolean} json JSON格式串
     * @return {Number|String}
     */
    now( json ) {
        return json ? new Date().toJSON() : Date.now();
    },

});



//
// Expose only $
///////////////////////////////////////////////////////////////////////////////


let _w$ = window.$;


/**
 * 恢复外部原始引用。
 * @return {tQuery}
 */
tQuery.noConflict = function() {
    if ( window.$ === tQuery ) window.$ = _w$;
    return tQuery;
};


if ( !noGlobal ) {
    window.$ = tQuery;
}


return tQuery;

});
