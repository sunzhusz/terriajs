'use strict';

// import classNames from 'classnames';
import flattenNested from '../../../../Core/flattenNested';
import ActiveConcept from './ActiveConcept';
import OpenInactiveConcept from './OpenInactiveConcept';
import Icon from '../../../Icon.jsx';
import ObserveModelMixin from '../../../ObserveModelMixin';
import React from 'react';
import Styles from './summarised-concept.scss';

const ADD_FIRST_TEXT = 'Add a condition';
const ADD_MORE_TEXT = 'Add new condition';

/*
 * SummarisedConcept displays all the active and open nodes under a given
 * SummaryConcept.
 * Parents containing 1 or more active nodes are shown via <./ActiveConcept>.
 *    (They may be open or closed, and ActiveConcept handles the difference.)
 * Open nodes not containing any active nodes are shown via <./OpenInactiveConcept>.
 *    (This is typically the case when a user has pressed the AddButton but yet to
 *    activate any leaf nodes.)
 * If summaryConcept.allowMultiple is true, then an <./AddButton> is also shown,
 *    which simply opens the root concept, at which point OpenInactiveConcept takes over.
 *
 * This design would need revision to handle concepts whose direct children are a mix of
 * both leaf nodes and parent nodes.
 *
 * This component cheekily uses the active concepts' isActive flag -
 * which is by rights the boolean true - to instead store an integer (>0) giving
 * the display order of the concepts. Since javascript identifies integers > 0 as truthy,
 * no one else should notice this trick.
 * (The other alternative would be to add a new property to VariableConcept.)
 */
const SummarisedConcept = React.createClass({
    mixins: [ObserveModelMixin],

    propTypes: {
        concept: React.PropTypes.object.isRequired,  // Must be a SummaryConcept.
        isLoading: React.PropTypes.bool
    },

    render() {
        const concept = this.props.concept;
        // Leaf nodes have either an undefined or a 0-length `items` array.
        const isLeafNode = concept => (!concept.items || concept.items.length === 0);
        const activeLeafNodes = concept.getNodes(isLeafNode).filter(concept => concept.isActive);
        const activeLeafNodesByParent = groupAndSortByParent(activeLeafNodes);
        const openDescendantsWithoutActiveChildren = getOpenDescendantsWithoutActiveChildren(concept);
        const isLoading = this.props.isLoading;
        return (
            <div className={Styles.root}>
                <div className={Styles.title}>{concept.name}:</div>
                <For each="group" index="i" of={activeLeafNodesByParent}>
                    <ActiveConcept key={i} rootConcept={concept} activeLeafNodesWithParent={group} isLoading={isLoading}/>
                </For>
                <If condition={activeLeafNodesByParent.length === 0 && openDescendantsWithoutActiveChildren.length === 0}>
                    <div className={Styles.noConditions}>
                        None
                    </div>
                </If>
                <If condition={openDescendantsWithoutActiveChildren.length > 0 && !isLoading}>
                    <OpenInactiveConcept rootConcept={concept} openInactiveConcept={openDescendantsWithoutActiveChildren[0]}/>
                </If>
                <If condition={concept.allowMultiple && openDescendantsWithoutActiveChildren.length === 0}>
                    <AddButton rootConcept={concept} numberOfExisting={activeLeafNodesByParent.length}/>
                </If>
            </div>
        );
    }
});

/**
 * We only want to show an <OpenInactiveConcept> if there is an open item without any active items in it.
 * This will return a flat array of any such concepts.
 * @param  {Concept} concept [description]
 * @return {Array} A nested array of open concepts.
 */
function getOpenDescendantsWithoutActiveChildren(concept) {
    const openDescendants = getOpenDescendants(concept);
    const flattenedOpenDescendants = flattenNested(openDescendants);
    return flattenedOpenDescendants.filter(hasNoActiveChildren);
}

/**
 * Returns a nested array of the open descendants of this concept (including itself).
 * If an open concept itself has open descendants, they are ignored.
 * @param  {Concept} concept [description]
 * @return {Array} A nested array of open concepts.
 */
function getOpenDescendants(concept) {
    if (concept.isOpen) {
        return [concept];
    }
    if (!concept.items) {
        return [];
    }
    return concept.items.map(child => getOpenDescendants(child));
}

/**
 * @param  {Concept} concept.
 * @return {Boolean} Does this concept have no active children?
 */
function hasNoActiveChildren(concept) {
    return !concept.items || concept.items.every(child => !child.isActive);
}

/**
 * Returns an array which groups all the nodes with the same parent id into one.
 * Cheekily sorts by the active concepts' isActive value - which is normally a boolean - if the first one isn't a boolean.
 * We do this so when you add a new condition (which starts out in <OpenInactiveConcept>, under all the active concepts),
 * it doesn't suddenly change position when you select your first concept (at which point it shows in <ActiveConcept>).
 * @param  {Concept[]} nodes [description]
 * @return {Object[]} An array of {parent: Concept, children: Concept[]} objects.
 * @private
 */
function groupAndSortByParent(nodes) {
    const nodesByParent = groupByParentId(nodes, parent => parent.id);
    if (nodesByParent.length > 0 && nodesByParent[0].children[0].isActive !== true) {
        nodesByParent.sort((a, b) => a.children[0].isActive - b.children[0].isActive);
    }
    return nodesByParent;
}

/**
 * Returns an array which groups all the nodes with the same parent id into separate sub-arrays.
 * @param  {Object[]} nodes An array of objects with a 'parent' property.
 * @param  {groupByParentId~idFunction} idFunction A function which gets the id of a parent.
 * @return {Object[]} An array of objects with keys parent, children.
 * @private
 */
function groupByParentId(nodes, idFunction) {
    const results = {};
    nodes.forEach(node => {
        const id = idFunction(node.parent);
        if (!results[id]) {
            results[id] = {parent: node.parent, children: []};
        }
        results[id].children.push(node);
    });
    return Object.keys(results).map(key => results[key]);
}

/**
* Function that is called to find the id of a parent.
* Eg. parent => parent.id.
* @callback groupByParentId~idFunction
* @param  {Object} parent A parent.
* @return {String} The parent id.
*/

const AddButton = React.createClass({
    mixins: [ObserveModelMixin],

    propTypes: {
        rootConcept: React.PropTypes.object.isRequired,
        numberOfExisting: React.PropTypes.number
    },

    addNew() {
        this.props.rootConcept.closeDescendants();
        this.props.rootConcept.isOpen = true;
    },

    render() {
        const addText = (this.props.numberOfExisting > 0) ? ADD_MORE_TEXT : ADD_FIRST_TEXT;
        return (
            <div className={Styles.section}>
                <button onClick={this.addNew} className={Styles.btnAddNew}>
                    <Icon glyph={Icon.GLYPHS.add}/>
                    <span className={Styles.text}>{addText}</span>
                </button>
            </div>
        );
    }
});

module.exports = SummarisedConcept;

