//! $Id: parser.js 2019.08.19 Tpb.Core $
//
// 	Project: Tpb v0.4.0
//  E-Mail:  zhliner@gmail.com
// 	Copyright (c) 2017 - 2019 铁皮工作室  MIT License
//
//////////////////////////////////////////////////////////////////////////////
//
//	OBT 解析器。
//
//
///////////////////////////////////////////////////////////////////////////////
//

import { Util } from "./util.js";
import { Spliter } from "./spliter.js";
import { On, By, To } from "./pbs.js";


const $ = window.$;


const
    // OBT默认属性名
    __obts = {
        on: 'on', 		// 触发事件和PB行为
        by: 'by', 		// 板块调用（传送器）
        to: 'to', 		// To输出目标
    },


    // 标识字符
    __chrDlmt   = ';',  // 并列分组
    __chrList   = ',',  // 指令/方法并列分隔
    __chrZero   = '-',  // 空白占位符

    // To
    __toqMore   = '+',  // 多元素检索前置标志
    __toqExtra  = '!',  // 进阶提取标志
    __tosAttr   = '@',  // 特性指定
    __tosProp   = '&',  // 属性指定
    __tosCSS    = '%',  // 样式指定


    // On事件定义模式。
    // 支持委托选择器，可前置 [.-] 标识字符。
    // 事件名支持字母、数字和 [._-] 字符。
    // 注：支持参数段内换行。
    __onEvent = /^[.-]?([\w.-]+)(?:\(([^]*)\))?$/,

    // 调用模式匹配。
    // 方法名支持字母、数字和 [._-] 字符。
    // 参数段支持任意字符（包括换行），可选。
    __obtCall = /^([\w][\w.-]*)(?:\(([^]*)\))?$/,

    // To:Query
    // 集合范围子集匹配：( beg, end )。
    // 取值：[1]
    __toRange = /^\(([\d,\s]*)\)$/,

    // To:Query
    // 集合定位取值匹配：[ 0, 2, 5... ]。
    // 取值：[0]
    __toIndex = /^\[[\d,\s]*\]$/,

    // To:Query
    // 集合过滤表达式匹配：{ filter-expr }。
    // 取值：[1]
    __toFilter = /^\{([^]*)\}$/,

    // 简单词组
    // 如空格分隔的多个事件名序列（可简单$.on绑定）。
    // 友好：支持句点字符。
    __reWords   = /^[\w][\w\s.]*$/;


const
    SSpliter    = new Spliter(),
    ASpliter    = new Spliter(true),
    AASpliter   = new Spliter(true, true),
    AABSpliter  = new Spliter(true, true, true);



//
// 流程数据栈。
// 每一个执行流对应一个数据栈实例。
//
class Stack {

    constructor() {
        this._buf = [];     // 数据栈
        this._item;         // 当前条目
        this._done = false; // 是否已暂存
        this._target;       // To 目标
    }


    /**
     * 接口：暂存区取值。
     * 可能自动取栈顶项，视n值而定：{
     *      0   暂存区有值则返回，不自动取栈
     *      1   暂存区有值则返回，否则取栈顶1项（值）
     *      n   暂存区有值则返回，否则取栈顶n项（Array）
     * }
     * 注：取值后暂存区会重置。
     * @param  {Number} n 取栈条目数
     * @return {Value|[Value]} 值/值集
     */
    data( n ) {
        try {
            if ( this._done ) {
                return this._item;
            }
            // 自动取栈
            if ( n == 1 ) this._pop();
            else if ( n > 1 ) this._pops( n );

            return this._item;
        }
        finally {
            this._done = false;
            this._item = undefined;
        }
    }


    /**
     * 接口：多态弹出。
     * 无实参传递时取栈赋值为单值。
     * 实参为一个数值时（0值有效），取栈n项构造为数组赋值。
     * 注：用于pop指令。
     * @param  {Number|null} n 弹出数量
     * @return {void}
     */
    pop( n ) {
        return n == null ? this._pop() : this._pops(n);
    }


    /**
     * 获取/设置更新目标。
     * 注：由To段指令使用。
     * @param  {Element|Collector} to 更新目标
     * @return {Element|Collector}
     */
    target( to ) {
        if ( to === undefined ) {
            return this._target;
        }
        this._target = to;
    }


    /**
     * 数据栈重置。
     * 用于执行流再次开启前使用。
     */
    reset() {
        this._buf.length = 0;
        this._done = false;
        this._item = this._target = undefined;

    }


    /**
     * 指令调用返回值入栈。
     * 内部接口：不接受 undefined 值入栈。
     * @param  {Value} val 入栈数据
     */
    _push( val ) {
        if ( val !== undefined ) this._buf.push( val );
    }


    /**
     * 弹出栈顶值暂存。
     * @return {void}
     */
    _pop() {
        this._done = true;
        this._item = this._buf.pop();
    }


    /**
     * 弹出栈顶多个条目暂存。
     * 0项或负值（非法）会构造为一个空集。
     * @param  {Number} n 弹出数量
     * @return {void}
     */
    _pops( n ) {
        this._done = true;
        this._item = n > 0 ? this._buf.splice(-n) : [];
    }
}


//
// 指令调用单元。
// 包含一个单向链表结构，实现执行流的链式调用逻辑。
//
// 注记：
// 取消原有脱链（dispose）设计，由单次事件绑定完成类似需求。
//
class Cell {
    /**
     * 构造指令单元。
     * @param {Stack} stack 当前链数据栈
     * @param {Cell} prev 前一个单元
     */
    constructor( stack, prev = null ) {
        this.next = null;
        this._stack = stack;
        this._meth = null;
        this._args = null;

        if (prev) prev.next = this;
    }


    /**
     * 方法/参数设置。
     * 传入方法内的this转换到数据栈。
     * @param  {Function} meth 目标方法（外部定义）
     * @param  {Array} args 模板配置的参数序列
     * @return {this}
     */
    bind( meth, args ) {
        // (...'') 无实参
        this._args = args || '';
        this._meth = meth.bind(this._stack);

        return this;
    }


    /**
     * 调用执行。
     * @param  {Object} evo 事件相关对象
     * @param  {Value} val 上一指令的结果
     * @return {Promise|void}
     */
    call( evo, val ) {
        this._stack._push(val);
        let _v = this._meth(evo, ...this._args);

        if ( this.next ) {
            return $.type(_v) == 'Promise' ? _v.then( o => this.next.call(evo, o) ) : this.next.call(evo, _v);
        }
    }

}


//
// On事件名定义。
// 针对单个事件的定义，由外部分解提取。
//
class Evn {
    /**
     * 解析格式化事件名。
     * - 前置句点（.）表示绑定单次执行。
     * - 前置短横线（-）表示延迟绑定事件处理器。
     * - 支持括号内指定委托选择器。
     * @param {String} name 格式化名称
     */
    constructor( name ) {
        let _vs = name.match(__onEvent);
        if ( !_vs ) {
            throw new Error('on-attr config is invalid.');
        }
        this.name     = _vs[1];
        this.selector = _vs[2] || null;
        this.once     = name[0] == '.';
        this.delay    = name[0] == '-';
    }

}


//
// 调用定义。
// 模板中指令/方法调用的配置存储。
//
class Call {
    /**
     * call支持句点引用子集成员。
     * 如：x.math.abs()
     * @param {String} fmt 调用格式串
     */
    constructor( fmt ) {
        let _vs = fmt.match(__obtCall);
        if ( !_vs ) {
            throw new Error('call-attr config is invalid.');
        }
        this._meth = _vs[1].split('.');
        this._args = _vs[2] && JSON.parse(`[${_vs[2]}]`);
    }


    /**
     * 应用到指令集。
     * 方法可能属于一个子集（x.y.m）。
     * 所有的方法都会绑定内部的this到cell对象，以方便调用必要的接口。
     * 注：
     * 如果你不需要上面的接口，可以自己先绑定（.bind()）。
     *
     * @param  {Cell} cell 指令单元
     * @param  {Object} pbs 指令集
     * @return {Cell} cell
     */
    apply( cell, pbs ) {
        let _m = this._meth.pop();
        pbs = this._host(this._meth, pbs) || pbs;

        return cell.bind(pbs[_m], this._args);
    }


    /**
     * 获取最终子集。
     * 提取末端方法的上级宿主对象，而非最终方法本身。
     * @param  {[String]} names 引用链
     * @param  {Object} pbs 指令集
     * @return {Object|0}
     */
    _host( names, pbs ) {
        return names.length && names.reduce( (o, k) => o[k], pbs );
    }

}


//
// To查询配置。
// 格式 {
//      xxx   // 单元素检索：$.get(): Element | null
//      +xxx  // 前置+字符，多元素检索：$(): Collector
//
//      +xxx!( Number, Number )       // 范围：slice()
//      +xxx![ Number, Number, ... ]  // 定点取值：[n]
//      +xxx!{ Filter-Expression }    // 过滤表达式：(v:Element, i:Number, o:Collector): Boolean
// }
//
class Query {
    /**
     * 构造查询配置。
     * 注：空值合法。
     * @param {String} qs 查询串
     */
    constructor( qs = '' ) {
        this._slr = qs;
        this._one = true;

        // 进阶获取。
        // function( Collector ): Collector
        this._fltr = null;

        if (qs[0] == __toqMore) {
            this._slr = qs.substring(1);
            this._one = false;
        }
        this.init( this._slr );
    }


    /**
     * 初始解析构造。
     * 需要处理进阶成员提取部分的定义。
     * @param {String} slr 选择器串
     */
    init( slr ) {
        if ( !slr ) {
            return;
        }
        let _vs = [...SSpliter.split(slr, __toqExtra, 1)];
        if (_vs.length == 1) {
            return;
        }
        this._slr = _vs[0];
        this._fltr = this._handle( _vs[1].trim() );
    }


    /**
     * 应用查询。
     * 绑定指令的方法和参数序列。
     * @param  {Cell} cell 指令单元
     * @return {Cell} cell
     */
    apply( cell ) {
        return cell.bind(
            this.query,
            [ this._slr, this._one, this._fltr ]
        );
    }


    /**
     * 目标检索。
     * 支持二阶检索和相对ID属性（见 Util.$find）。
     * this 为 Stack 实例。
     * 支持暂存区当前条目为目标（由前阶末端指令遗留）。
     *
     * @param  {Object} evo 事件关联对象
     * @param  {String} slr 选择器串（二阶）
     * @param  {Boolean} one 是否单元素版
     * @param  {Function} fltr 进阶过滤提取
     * @return {void}
     */
    query( evo, slr, one, fltr ) {
        let _beg = this.data(0);

        if (_beg === undefined) {
            _beg = evo.current;
        }
        this.target( query2(slr, _beg, one, fltr) );
    }


    /**
     * 创建提取函数。
     * 接口：function( all:Collector ): Collector
     * @param  {String} fmt 格式串
     * @return {Function} 取值函数
     */
    _handle( fmt ) {
        if ( !fmt ) {
            return null;
        }
        if ( __toRange.test(fmt) ) {
            return this._range( fmt.match(__toRange)[1] );
        }
        if ( __toIndex.test(fmt) ) {
            return this._index( fmt.match(__toIndex)[0] );
        }
        if ( __toFilter.test(fmt) ) {
            return this._filter( fmt.match(__toFilter)[1] );
        }
    }


    /**
     * 范围成员提取。
     * @param  {String} fmt 参数串：beg, end
     * @return {Function}
     */
    _range( fmt ) {
        let _n2 = JSON.parse( `[${fmt}]` );
        return all => all.slice( _n2[0], _n2[1] );
    }


    /**
     * 定点成员提取。
     * @param  {String} fmt 定位串：[m, n, ...]
     * @return {Function}
     */
    _index( fmt ) {
        let _nx = JSON.parse( fmt );
        return all => _nx.map( i => all[i] ).filter( v => v );
    }


    /**
     * 过滤器提取。
     * @param  {String} fmt 过滤表达式
     * @return {Function}
     */
    _filter( fmt ) {
        let _fn = new Function(
                'v', 'i', 'o', `return ${fmt};`
            );
        return all => all.filter( _fn );
    }
}


/**
 * 检索目标元素。
 * 从起点元素上下检索目标元素（集）。
 * 进阶过滤：function( Collector ): Collector
 * 注记：
 * beg可能从暂存区取值为一个集合，已要求slr部分为空。
 * 因此代码工作正常。
 *
 * @param  {String} slr 双阶选择器
 * @param  {Element|null} beg 起点元素
 * @param  {Boolean} one 是否单元素查询
 * @param  {Function} fltr 进阶过滤函数
 * @return {Element|Collector}
 */
function query2( slr, beg, one, fltr ) {
    let _v = Util.$find( slr, beg, one );
    return one ? _v : ( fltr ? fltr(_v) : _v );
}


//
// To设置配置（多）。
// 即 Where/Method/Set 段配置。
// 大多数方法为简单的规范名称，如：before, after, wrap, height 等。
// 特性/属性/样式三种配置较为特殊，采用前置标志字符表达：{
//      @   特性（attr），如：@title => $.attr(el, 'title', ...)
//      &   属性（prop），如：&value => $.prop(el, 'value', ...)
//      %   样式（css）， 如：%font-size => $.css(el, 'font-size', ...)
// }
// 支持多方法并列定义，用逗号（__chrList）分隔。
// 注记：
// 并列的方法可视为独立作用，但内容数据取值需要考虑是否为数组。
//
class Sets {

    constructor( fmt ) {
        let _ns = fmt.split(__chrList);
        //
        // 提供数据、目标，构建并列的单方法封装，
    }


    /**
     * 应用设置。
     * @param {Cell} cell 指令单元
     * @param {Object} mset 方法集（Where/Method/Set）
     */
    apply( cell, mset ) {
        //
        // 绑定到链式指令（对外）
    }


    update( evo, ...rest ) {
        //
        // 各个单方法封装打包执行。
    }

}


//
// To设置配置（单）
// 为Sets提供单个方法调用封装，数据/目标由Sets提供。
// 注：不对外（Cell）。
//
class Method {

    constructor( fmt ) {
        //
    }

}


//
// To下一阶配置。
//
class Stage {
    //
}


//
// 工具函数。
///////////////////////////////////////////////////////////////////////////////




const _Parser = {
    /**
     * OBT一起解析。
     * 返回值：{
     *  	on: [{evs, pbs}]
     *  	by: [Sender]
     *  	to: [{updater, pbs}]
     * }
     * @param  {String} on On配置值
     * @param  {String} by By配置值
     * @param  {String} to To配置值
     * @return {Object}
     */
    all( on, by, to ) {
        return {
            on: this.on(on),
            by: this.by(by) || [],
            to: this.to(to) || [],
        };
    },


    /**
     * on="
     *  	Ev;  // 单纯事件，分号分组
     *  	Ev|pb, pbs()...;  // PB行为链（1个或多个）
     *  	Ev Ev...|pb, pbs()...;   // 多个普通事件
     *  	Ev Ev()...|pb, pb()...;  // 普通事件与委托事件混合
     * "
     * 返回值：[{
     *  	evs: [ names, { name, args }, name... ],
     *  	pbs: [ Caller ]
     * }...]
     * @param  {String} fmt 配置格式串
     * @return {Array}
     */
    on( fmt ) {
        let _buf = [];

        for ( let ss of DlmtSpliter.split(fmt) ) {
            let _pair = Util.rePair(ss, __rePipe);
            _buf.push({
                evs: this._onEvs(_pair[0].trim()),
                pbs: this._pbCalls(_pair[1].trim())
            });
        }
        return _buf;
    },


    /**
     * tpb-by="
     *  	Plate.call();  // Plate板块里的call方法
     *  	Plate.Sub.call;  // 支持多级引用，无参数可省略括号
     * "
     * @param  {String} fmt 配置格式串
     * @return {[Sender]}
     */
    by( fmt ) {
        if (!fmt) return;

        return [...DlmtSpliter.split( fmt, s => s.trim() )]
            .map(
                ss => ss == __chrZero ? null : this._sender(ss)
            );
    },


    /**
     * tpb-to="
     *  	rid|where;
     *  	rid|where|pbs...;
     * "
     * 返回值：[{
     *  	updater: {Updater},
     *  	pbs: [Caller]|null
     * }...]
     * @param  {String} fmt 格式串
     * @return {Array} 更新器实例&PBs序列的数组
     */
    to( fmt ) {
        if (!fmt) return;
        let _buf = [];

        for ( let ss of DlmtSpliter.split( fmt, s => s.trim() ) ) {
            if (!ss) continue;
            let [updater, _pbs] = this._updater(ss);

            _buf.push({
                updater,
                pbs: this._pbCalls(_pbs.trim()),
            });
        }
        return _buf;
    },


    //-- 私有辅助 -------------------------------------------------------------


    /**
     * 解析On中的事件名序列。
     * - 委托被解析为一个对象 {name, args}；
     * - 事件名支持前置短横线-（预定义）；
     * 格式：{
     *  	evn evn evn('slr')
     *  	evn -evn -evn(..)
     * }
     * @param  {String} fmt 事件定义串
     * @return {Array} 结果数组
     */
    _onEvs( fmt ) {
        if (!fmt) return null;

        if (__reWords.test(fmt)) {
            return [fmt];
        }
        fmt = fmt.replace(/\s+/g, ' ');

        return [...EvnSpliter.split(fmt, s => s.trim())]
            .map(
                ss => Util.funcArgs(ss)
            );
    },


    /**
     * 解析调用序列。
     * - PB调用链中的定义：pb, pb(...), ev.point...
     * @param  {String} fmt 调用定义串
     * @return {[Caller]} 调用器数组
     */
    _pbCalls( fmt ) {
        if (!fmt) return null;

        let _buf = [];

        for ( let it of CallSpliter.split(fmt) ) {
            let _cal = this._caller(it.trim());
            if (_cal) _buf.push(_cal);
        }
        return _buf.length && _buf;
    },


    /**
     * 解析调用串。
     * @param  {String} fmt 调用串
     * @return {Caller} 调用器实例
     */
    _caller( fmt ) {
        let {name, args} = Util.funcArgs(fmt);
        if (!name) return null;

        return new Caller(name, args);
    },


    /**
     * 解析板块调用。
     * @param  {String} fmt 调用串
     * @return {Sender} 发送器实例
     */
    _sender( fmt ) {
        let {name, args} = Util.funcArgs(fmt);
        if (!name) return null;

        let _list = name.split('.');

        return new Sender(_list.pop(), args, _list);
    },


    /**
     * 解析更新调用。
     * @param  {String} fmt 更新配置串
     * @return {[Updater, pbs]} 更新器和后续PB序列
     */
    _updater( fmt ) {
        if (!fmt) return null;

        let _lst = fmt.split(__rePipe),
            [_slr, _all] = this._toRids(_lst[0]);

        // 首尾引号
        if (__reString.test(_slr)) {
            _slr = _slr.slice(1, -1).trim();
        }
        return [
            new Updater(_slr, _lst[1] || '', _all),
            _lst[2] || '',
        ];
    },


    /**
     * 解析提取To的rid定义。
     * - 格式串包含rid字符串和可能有的true参数；
     *   （如：'form@ b', true）
     * @param  {String} fmt 格式串
     * @return {[String, Boolean]}
     */
    _toRids( fmt ) {
        // jshint unused:false
        let [_, rid, all] = fmt.trim().match(__reTorid);

        return [ rid.trim(), !!all ];
    },

};
