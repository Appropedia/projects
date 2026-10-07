const Admin = {

	init: function () {
		Admin.fixFilters();
		Admin.bind();
		Admin.search();
	},

	/**
	 * Bind events
	 */
	bind: function () {

		// Update the table and the filter width when a filter changes
		const filters = document.getElementsByClassName( 'appropedia-filter' );
		for ( const filter of filters ) {
			filter.onchange = Admin.onFilterChange;
		}
	},

	search: async function () {

		const body = document.getElementById( 'appropedia-table-body' );
		body.textContent = 'Searching...';

		// Set the query conditions
		const conditions = [
			'Category:Projects'
		];
		const params = new URLSearchParams( window.location.search );
		const type = params.get( 'type' );
		if ( type ) {
			conditions.push( 'Project type::' + type );
		}
		const status = params.get( 'status' );
		if ( status ) {
			conditions.push( 'Project status::' + status );
		}
		const environment = params.get( 'environment' );
		if ( environment ) {
			conditions.push( 'Project environment::' + environment );
		}
		const sdg = params.get( 'sdg' );
		if ( sdg ) {
			conditions.push( 'SDG::' + sdg );
		}
		const language = params.get( 'language' );
		if ( language ) {
			conditions.push( 'Language code::' + language );
		}
		const year = params.get( 'year' );
		if ( year ) {
			conditions.push( 'Date::' + year );
		}

		const properties = [
			'Date',
			'Description',
			'Language code',
			'Project authors',
			'Project description', // @todo
			'Project type',
			'Project status',
			'Project cost',
			'Project tools',
			'Project uses',
			'Project environment', // @todo
			'Project was made',
			'Project was replicated',
			'Project thumb'
		];
		const parameters = [
			'sort = Date',
			'order = desc',
			'limit = 100'
		]
		const query = {
			origin: '*',
			format: 'json',
			action: 'askargs',
			conditions: conditions.join( '|' ),
			printouts: properties.join( '|' ),
			parameters: parameters.join( '|' ),
		};
		const response = await Admin.get( query );
		const results = Object.entries( response.query.results );

		// If no results are found, be done
		if ( !results.length ) {
			cards.textContent = 'No relevant projects found.';
			return;
		}

		body.textContent = '';
		for ( const [ title, result ] of results ) {
			const project = {
				title: title,
				hash: title.replaceAll( ' ', '_' ),
				url: result.fullurl,
				thumb: result.printouts['Project thumb'][0],
				type: result.printouts['Project type'][0],
				status: result.printouts['Project status'][0],
				year: result.printouts['Date'][0].raw.split( '/' ).pop(),
				language: result.printouts['Language code'][0],
				description: result.printouts['Description'][0],
				authors: result.printouts['Project authors'][0]
			};
			const row = Admin.makeRow( project );
			body.append( row );
		}
	},

	makeRow: function ( project ) {
		const template = document.getElementById( 'project-row-template' );
		const row = template.content.cloneNode( true ).children[0];

		const title = row.querySelector( '.project-row-title' );
		title.textContent = project.title;
		row.dataset.title = project.title;

		const description = row.querySelector( '.project-row-description' );
		description.textContent = project.description;

		const image = row.querySelector( '.project-row-image' );
		image.textContent = project.thumb ? 'Yes' : 'No';

		const type = row.querySelector( '.project-row-type' );
		type.textContent = project.type ? project.type.fulltext : '';
		type.addEventListener( 'focusout', event => Admin.updateType( event, project ) );

		const status = row.querySelector( '.project-row-status' );
		status.textContent = project.status ? project.status : '';

		const language = row.querySelector( '.project-row-language' );
		language.textContent = project.language ? project.language : '';
	
		const year = row.querySelector( '.project-row-year' );
		year.textContent = project.year ? project.year : '';

		return row;
	},

	updateType: async function ( event, project ) {
		const td = event.target;
		const type = td.textContent;
		if ( type === project.type ) {
			return;
		}
		const row = td.parentElement;
		const title = row.dataset.title;
		const wikitext = await Admin.getWikitext( title );

		// Update the wikitext
		const template = WikitextParser.getTemplate( wikitext, 'Project data' );
		const params = WikitextParser.getTemplateParameters( template );
		let newTemplate;
		if ( params.type ) {
			newTemplate = template.replace( '| type = ' + params.type, '| type = ' + type );
		} else {
			newTemplate = template.replace( '}}', '| type = ' + type + '\n}}' );
		}
		let newWikitext = wikitext.replace( template, newTemplate );

		// Save the changes
		const query = {
			action: 'edit',
			title: title,
			text: newWikitext,
			summary: 'Update project status'
		};
		const result = await Admin.post( query );
		console.log( result );
	},

	/**
	 * Filters are not selected by default, so we need to select them if the relevant query string is set
	 */
	fixFilters: function () {
		const params = new URLSearchParams( window.location.search );
		const filters = document.getElementsByClassName( 'appropedia-filter' );
		for ( const filter of filters ) {
			const name = filter.name;
			const value = params.get( name );
			if ( value ) {
				for ( const option of filter.options ) {
					if ( value === option.value ) {
						option.selected = 'selected';
						Admin.fixFilterWidth( filter );
					}
				}
			}
		}
	},

	/**
	 * Create a dummy filter to figure out the new optimal width
	 */
	fixFilterWidth: function ( filter ) {
		const option = filter.options[ filter.selectedIndex ];
		const dummy = document.createElement( 'span' );
		dummy.textContent = option.text;
		dummy.className = 'appropedia-filter';
		dummy.style.position = 'absolute';
		dummy.style.visibility = 'hidden';
		document.body.append( dummy );
		filter.style.width = dummy.offsetWidth + 'px';
		dummy.remove();
	},

	onFilterChange: function ( event ) {
		const filter = event.target;

		// Update the URL
		const url = new URL( window.location.href );
		const params = new URLSearchParams( url.search );
		if ( filter.value ) {
			params.set( filter.name, filter.value );
		} else {
			params.delete( filter.name );
		}
		url.search = params.toString();
		window.history.pushState( {}, '', url.toString() );

		// Update the width of the filter
		Admin.fixFilterWidth( filter );

		// Update the projects
		Admin.search();
	},

	/**
	 * Helper method to do GET requests to the Appropedia Action API
	 */
	get: async function ( query ) {
		query.format = 'json';
		query.formatversion = 2;
		const queryString = new URLSearchParams( query ).toString();
		const response = await fetch( 'https://www.appropedia.org/w/api.php?' + queryString );
		if ( !response.ok ) {
			// @todo Error handling
		}
		const data = await response.json();
		return data;
	},

	getWikitext: async function ( title ) {
		const query = {
			action: 'parse',
			page: title,
			prop: 'wikitext'
		};
		const response = await Admin.get( query );
		const wikitext = response.parse.wikitext;
		return wikitext;
	},

	/**
	 * Helper method to do POST requests to the Appropedia Action API
	 */
	post: async function ( query ) {
		const data = await Admin.get( { action: 'query', meta: 'tokens' } );
		const token = data.query.tokens.csrftoken;
		query.token = token;
		query.format = 'json';
		query.formatversion = 2;
		const queryString = new URLSearchParams( query ).toString();
		const response = await fetch( 'https://www.appropedia.org/w/api.php', {
			method: 'POST',
			body: new URLSearchParams( query )
		} );
		if ( !response.ok ) {
			// @todo Error handling
		}
		const result = await response.json();
		return result;
	},
	
	/**
	 * Helper method to get cookies
	 */
	getCookie: function ( name ) {
		const regex = new RegExp( '(^| )' + name + '=([^;]+)' );
		const match = document.cookie.match( regex );
		if ( match ) {
			return match[2];
		}
	}
}

window.onload = Admin.init;