// $Id: templater.js 2019.09.02 Tpb.Tools $
// ++++++++++++++++++++++++++++++++++++++++++
//  Project: Tpb v0.4.0
//  E-Mail:  zhliner@gmail.com
//  Copyright (c) 2019 - 2020 铁皮工作室  MIT License
//
//////////////////////////////////////////////////////////////////////////////
//
//  模板管理器。
//
//  提取文档内定义的模板节点，解析构建OBT逻辑和渲染配置并存储节点供检索。
//  如果DOM中有子模版配置，会实时导入并解析存储。
//
//  解析顺序：
//      1. 导入根模板节点。
//      2. 解析OBT配置，构建调用链并绑定。
//      3. 解析渲染文法（Render.parse）。
//      4. 如果有模板中包含子模版，导入并解析之。
//
//
///////////////////////////////////////////////////////////////////////////////
//

// 无渲染支持。
// import { Render } from "./render.x.js";

// 有渲染支持。
import { Render } from "./render.js";


const
    $ = window.$,

    // 子模版分隔符
    __loadSplit = ',',

    // 特性名定义。
    __tplName   = 'tpl-name',   // 模板节点命名
    __tplNode   = 'tpl-node',   // 模板节点引入（克隆）
    __tplSource = 'tpl-source', // 模板节点引入（原始）

    // 模板添加完成事件。
    __tplDone   = 'tpled',

    // 选择器。
    __nameSlr   = `[${__tplName}]`,
    __nodeSlr   = `[${__tplNode}], [${__tplSource}]`;


class Templater {
    /**
     * 创建实例。
     * obter: function( Element ): Promise<void>
     * loader: function( String ): Promise<DocumentFragment>
     * @param {Function} obter OBT解析回调
     * @param {Function} loader 节点载入回调
     */
    constructor( obter, loader ) {
        this._obter = obter;
        this._loader = loader;

        // 模板节点存储（已就绪）
        // { String: Element }
        this._tpls = new Map();

        // 临时存储（就绪后移除）
        this._tplx = new Map();  // 有子模版的模板节点 {name: Promise}
        this._pool = new Map();  // 初始载入文档片段或元素 {root: Promise}
    }


    /**
     * 获取模板节点（原始）。
     * 如果模板不存在会自动载入。
     * @param  {String} name 模板名
     * @return {Promise<Element>} 承诺对象
     */
    get( name ) {
        let _tpl = this._tpls.get( name );

        if ( _tpl ) {
            return Promise.resolve( _tpl );
        }
        return this._tplx.get( name ) || this._load( name );
    }


    /**
     * 克隆模板节点。
     * 如果模板不存在，会自动尝试载入。
     * 注：克隆包含渲染文法。
     * @param  {String} name 模板名
     * @return {Promise<Element>} 承诺对象
     */
    clone( name ) {
        return this.get( name ).then( el => this._clone(el) );
    }


    /**
     * 返回既有模板节点或其副本。
     * @param  {String} name 节点名
     * @param  {Boolean} clone 是否克隆（含渲染文法）
     * @return {Element|null}
     */
    node( name, clone ) {
        let _tpl = this._tpls.get( name ) || null;
        return clone ? this._clone( _tpl ) : _tpl;
    }


    /**
     * 获取既有模板节点集。
     * 未找到的节点值为 null。
     * @param  {[String]} names 名称集
     * @param  {Boolean} clone 是否克隆（含渲染文法）
     * @return {[Element|null]}
     */
    nodes( names, clone ) {
        return names.map( n => this.node(n, clone) );
    }


    /**
     * 模板构建。
     * 元素实参主要用于初始或手动调用，
     * 系统自动载入并构建时，实参为文档片段。
     * @param  {Element|Document|DocumentFragment} root 构建目标
     * @return {Promise<true>}
     */
    build( root ) {
        if ( this._pool.has(root) ) {
            return this._pool.get(root);
        }
        // 注记：
        // 先从总根构建OBT后再处理子模版可以节省解析开销，
        // 否则子模板克隆会直接复制OBT特性，相同值重复解析。
        let _pro = this._obter( root )
            .then( () => this.picks(root) )
            .then( () => this._pool.delete(root) );

        this._pool.set( root, _pro );

        return Render.parse( root ) && _pro;
    }


    /**
     * 提取并存储命名的模板节点。
     * 检查不在命名模版节点内的子模版导入配置。
     * @param  {Element|DocumentFragment} root 根容器
     * @return {[Promise<void>]}
     */
    picks( root ) {
        // 先提取命名模板。
        for ( const tpl of $.find(__nameSlr, root, true) ) {
            this.add( tpl );
            // 可用于即时移除节点（脱离DOM）。
            $.trigger( tpl, __tplDone, null, false, false );
        }
        // 模板外的导入处理。
        let _ps = this._subs( root );

        return _ps ? Promise.all(_ps) : Promise.resolve();
    }


    /**
     * 添加模板节点。
     * 元素应当包含tpl-name特性值。
     * @param  {Element} tpl 模板节点元素
     * @return {Map|void}
     */
    add( tpl ) {
        let _name = $.xattr( tpl, __tplName ),
            _subs = this._subs( tpl );

        if ( !_subs ) {
            return this._tpls.set( _name, tpl );
        }
        let _pro = Promise.all( _subs )
            .then( () => this._tpls.set(_name, tpl) )
            .then( () => this._tplx.delete(_name) && tpl );

        this._tplx.set( _name, _pro );
    }


    //-- 私有辅助 -------------------------------------------------------------


    /**
     * 载入模板节点。
     * @param  {String} name 模板名
     * @return {Promise<Element>}
     */
    _load( name ) {
        return this._loader( name )
            .then( fg => this.build(fg) )
            .then( () => this._tpls.get(name) || this._tplx.get(name) );
    }


    /**
     * 克隆模板节点。
     * 会同时克隆渲染文法（如果有）以及绑定的事件处理器。
     * @param  {Element} tpl 原模板节点
     * @return {Element} 克隆的新节点
     */
    _clone( tpl ) {
        return tpl && Render.clone(
            tpl,
            $.clone( tpl, true, true, true )
        );
    }


    /**
     * 解析/载入子模板。
     * 即处理 tpl-node/tpl-source 两个指令。
     * @param  {Element|DocumentFragment} root 根容器
     * @return {[Promise<void>]} 子模版载入承诺集
     */
     _subs( root ) {
        let _els = $.find(__nodeSlr, root, true);

        if ( _els.length === 0 ) {
            return null;
        }
        return $.map( _els, el => this._imports(el) );
    }


    /**
     * 导入元素引用的子模版。
     * 子模版定义可能是一个列表（有序）。
     * 可能返回null，调用者应当滤除。
     * @param  {Element} el 配置元素
     * @return {Promise<void>|null}
     */
    _imports( el ) {
        let [meth, val] = this._reference(el);

        if ( !val ) {
            return null;
        }
        return Promise.all(
            val.split(__loadSplit).map( n => this[meth](n.trim()) )
        )
        // $.replace
        // tQuery:nodeok 定制事件可提供初始处理机制。
        .then( els => $.replace( el, els) )
    }


    /**
     * 获取节点引用。
     * tpl-node与tpl-source不能同时配置，否则后者无效。
     * 返回取值方法名和配置值。
     * @param  {Element} el 配置元素
     * @return {[method, value]}
     */
    _reference( el ) {
        let _n = el.hasAttribute(__tplNode) ? __tplNode : __tplSource,
            _v = $.xattr( el, _n );

        return [ _n == __tplNode ? 'clone' : 'get', _v.trim() ];
    }
}


export { Templater };
